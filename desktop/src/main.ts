import { app, BrowserWindow, Menu, dialog, ipcMain, session, shell, type IpcMainInvokeEvent } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import { loadWindowState, saveWindowState, MIN_HEIGHT, MIN_WIDTH } from './window-state'
import { closeLog, log, logDirectory } from './logger'
import { startStaticServer, type StaticServer } from './static-server'
import { cleanupOrphanProcesses, startBackend, type BackendHandle } from './backend-manager'

// 允许外部（未来的本地后端启动器）指定用户数据目录；未指定时使用 Electron 默认目录。
const DATA_DIR = process.env.MU_DATA_DIR
if (DATA_DIR) {
  app.setPath('userData', path.resolve(DATA_DIR))
}

const DEV_SERVER_URL = process.env.ELECTRON_START_URL || ''
let APP_URL = DEV_SERVER_URL || process.env.MU_APP_URL || 'http://127.0.0.1:8080'
let APP_ORIGIN = new URL(APP_URL).origin
const IS_DEV = Boolean(DEV_SERVER_URL)
let staticServer: StaticServer | null = null

// 终端/输出管道被关闭时，stdout 写入会抛 EBADF/EPIPE；这类日志错误不应弹窗或终止应用。
process.on('uncaughtException', (error: NodeJS.ErrnoException) => {
  if (error.code === 'EBADF' || error.code === 'EPIPE') {
    return
  }
  log('app', `未捕获异常: ${error.stack ?? error.message}`)
  try {
    dialog.showErrorBox('Memory Universe', error.message)
  } catch {
    // 对话框不可用时仅记录日志
  }
})

process.on('unhandledRejection', (reason) => {
  log('app', `未处理的 Promise 拒绝: ${String(reason)}`)
})

const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "media-src 'self' blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "object-src 'none'",
  "frame-src 'none'",
  "base-uri 'self'",
  "form-action 'self'"
].join('; ')

let mainWindow: BrowserWindow | null = null
let saveTimer: NodeJS.Timeout | undefined
let showingLoadError = false
let loadAttempts = 0
let appUrlReady = false
let backendHandle: BackendHandle | null = null
let isQuitting = false
let shuttingDown = false
let recovering = false
let autoRestarts = 0
let manualRestarts = 0

const MAX_LOAD_ATTEMPTS = 3
const MAX_AUTO_RESTARTS = 1
const MAX_MANUAL_RESTARTS = 3
const MIN_VALID_SIZE = 400

log('boot', `packaged=${app.isPackaged} devUrl=${DEV_SERVER_URL || '(none)'} appUrl=${APP_URL}`)
log('boot', `userData=${app.getPath('userData')}`)

function isAllowedNavigation(rawUrl: string): boolean {
  try {
    return new URL(rawUrl).origin === APP_ORIGIN
  } catch {
    return false
  }
}

function isTrustedSender(event: IpcMainInvokeEvent): boolean {
  try {
    const frameUrl = event.senderFrame?.url || event.sender.getURL()
    return new URL(frameUrl).origin === APP_ORIGIN
  } catch {
    return false
  }
}

// 启动失败页由主进程以 data:text/html 加载，只允许它调用后端恢复与退出相关通道。
function isInternalPage(event: IpcMainInvokeEvent): boolean {
  try {
    const frameUrl = event.senderFrame?.url || ''
    return frameUrl.startsWith('data:text/html')
  } catch {
    return false
  }
}

function assertNoArguments(args: unknown[]): void {
  if (args.length > 0) {
    throw new Error('该 IPC 通道不接受参数')
  }
}

function registerIpc(): void {
  const handle = (channel: string, action: (event: IpcMainInvokeEvent) => unknown) => {
    ipcMain.handle(channel, (event, ...args: unknown[]) => {
      if (!isTrustedSender(event)) {
        throw new Error('拒绝来自未知来源的调用')
      }
      assertNoArguments(args)
      return action(event)
    })
  }

  const windowOf = (event: IpcMainInvokeEvent): BrowserWindow => {
    const window = BrowserWindow.fromWebContents(event.sender)
    if (!window) {
      throw new Error('窗口不存在')
    }
    return window
  }

  const handleInternal = (channel: string, action: () => unknown) => {
    ipcMain.handle(channel, (event, ...args: unknown[]) => {
      if (!isInternalPage(event)) {
        throw new Error('拒绝来自未知来源的调用')
      }
      assertNoArguments(args)
      return action()
    })
  }

  handle('app:get-info', () => ({
    version: app.getVersion(),
    platform: process.platform,
    packaged: app.isPackaged
  }))

  handle('app:open-data-directory', async () => {
    const error = await shell.openPath(app.getPath('userData'))
    return error === ''
  })

  handle('window:minimize', (event) => {
    log('ipc', `window:minimize from ${event.senderFrame?.url || 'unknown'}`)
    windowOf(event).minimize()
    return true
  })

  handle('window:toggle-maximize', (event) => {
    const window = windowOf(event)
    if (window.isMaximized()) {
      window.restore()
    } else {
      window.maximize()
    }
    return window.isMaximized()
  })

  handle('window:close', (event) => {
    windowOf(event).close()
    return true
  })

  handle('window:toggle-fullscreen', (event) => {
    const window = windowOf(event)
    window.setFullScreen(!window.isFullScreen())
    return window.isFullScreen()
  })

  handle('window:is-maximized', (event) => windowOf(event).isMaximized())

  handleInternal('backend:restart', () => manualRestart())

  handleInternal('app:open-log-directory', async () => {
    const error = await shell.openPath(logDirectory())
    return error === ''
  })

  handleInternal('app:quit', () => {
    void beginShutdown()
    return true
  })
}

function applyProductionCsp(): void {
  if (IS_DEV || !app.isPackaged) {
    return
  }
  session.defaultSession.webRequest.onHeadersReceived({ urls: ['*://*/*'] }, (details, callback) => {
    if (isAllowedNavigation(details.url)) {
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          'Content-Security-Policy': [CSP]
        }
      })
      return
    }
    callback({ responseHeaders: details.responseHeaders })
  })
}

function showLoadError(window: BrowserWindow, detail: string): void {
  if (showingLoadError) {
    return
  }
  showingLoadError = true
  log('window', `显示离线提示页: ${detail}`)
  const html = `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<title>Memory Universe</title>
<style>
  html, body { height: 100%; margin: 0; }
  body {
    display: grid; place-items: center; background: #050816; color: #e2e8f0;
    font-family: 'Segoe UI', 'Microsoft YaHei', sans-serif;
  }
  .card { max-width: 30rem; padding: 2.4rem; text-align: center; }
  h1 { font-size: 1.1rem; letter-spacing: .18em; color: #7dd3fc; }
  p { font-size: .85rem; line-height: 1.9; color: #94a3b8; }
  a {
    display: inline-block; margin-top: 1.4rem; padding: .65rem 1.5rem;
    border: 1px solid rgba(56,189,248,.45); border-radius: 999px;
    color: #bae6fd; text-decoration: none; font-size: .8rem;
  }
</style>
</head>
<body>
  <div class="card">
    <h1>MEMORY UNIVERSE</h1>
    <p>本地服务尚未就绪，页面暂时无法加载。</p>
    <p>${detail}</p>
    <a href="${APP_URL}">重新连接</a>
  </div>
</body>
</html>`
  void window.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html))
}

function showStartupError(window: BrowserWindow, detail: string): void {
  if (showingLoadError) {
    return
  }
  showingLoadError = true
  log('window', `显示启动失败页: ${detail}`)
  const logs = logDirectory()
  const html = `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<title>Memory Universe</title>
<style>
  html, body { height: 100%; margin: 0; }
  body {
    display: grid; place-items: center;
    background: radial-gradient(circle at 50% 35%, #0b1530 0%, #050816 70%);
    color: #e2e8f0; font-family: 'Segoe UI', 'Microsoft YaHei', sans-serif;
  }
  .card { max-width: 36rem; padding: 2.4rem 2.6rem; text-align: center; }
  h1 { font-size: 1.05rem; letter-spacing: .24em; color: #fca5a5; font-weight: 500; }
  p { font-size: .84rem; line-height: 1.9; color: #94a3b8; }
  code { color: #7dd3fc; word-break: break-all; }
  .actions { display: flex; gap: .8rem; justify-content: center; flex-wrap: wrap; margin-top: 1.6rem; }
  button {
    padding: .62rem 1.4rem; border-radius: 999px; cursor: pointer;
    font-size: .8rem; letter-spacing: .04em; color: #bae6fd;
    background: rgba(56, 189, 248, .06); border: 1px solid rgba(56, 189, 248, .45);
    transition: all .2s ease;
  }
  button:hover:not(:disabled) { background: rgba(56, 189, 248, .18); border-color: #38bdf8; }
  button:disabled { opacity: .45; cursor: not-allowed; }
  #status { min-height: 1.4rem; margin-top: 1.1rem; color: #7dd3fc; font-size: .78rem; }
</style>
</head>
<body>
  <div class="card">
    <h1>MEMORY UNIVERSE 后端服务异常</h1>
    <p>本地数据服务未能启动或已意外退出，应用暂时无法进入。</p>
    <p>错误原因：${detail.replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' })[c] || c)}</p>
    <p>日志目录：<code>${logs}</code></p>
    <div class="actions">
      <button id="restart">重新启动服务</button>
      <button id="logs">打开日志目录</button>
      <button id="quit">退出应用</button>
    </div>
    <p id="status"></p>
  </div>
  <script>
    (function () {
      var status = document.getElementById('status')
      var restartBtn = document.getElementById('restart')
      var restarting = false
      function setStatus(text) { status.textContent = text || '' }

      restartBtn.addEventListener('click', function () {
        if (restarting) { return }
        restarting = true
        restartBtn.disabled = true
        setStatus('正在重新启动本地数据服务…')
        window.desktop.backend.restart().then(function (result) {
          if (!result || !result.ok) {
            setStatus((result && result.error) || '重新启动失败')
            restartBtn.disabled = false
            restarting = false
          }
        }).catch(function (error) {
          setStatus('重新启动失败：' + String(error))
          restartBtn.disabled = false
          restarting = false
        })
      })

      document.getElementById('logs').addEventListener('click', function () {
        window.desktop.openLogDirectory()
      })

      document.getElementById('quit').addEventListener('click', function () {
        window.desktop.quit()
      })
    })()
  </script>
</body>
</html>`
  void window.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html))
}

function loadSplash(window: BrowserWindow): void {
  showingLoadError = false
  const html = `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<title>Memory Universe</title>
<style>
  html, body { height: 100%; margin: 0; }
  body {
    display: grid; place-items: center; background: radial-gradient(circle at 50% 40%, #0b1530 0%, #050816 70%);
    color: #e2e8f0; font-family: 'Segoe UI', 'Microsoft YaHei', sans-serif;
  }
  .card { text-align: center; }
  h1 { font-size: 1rem; letter-spacing: .32em; color: #7dd3fc; font-weight: 500; }
  p { margin-top: 1rem; font-size: .8rem; color: #94a3b8; letter-spacing: .08em; }
  .dot {
    width: 6px; height: 6px; margin: 1.6rem auto 0; border-radius: 50%;
    background: #38bdf8; box-shadow: 0 0 18px #38bdf8; animation: pulse 1.4s ease-in-out infinite;
  }
  @keyframes pulse { 0%, 100% { opacity: .25; transform: scale(.85); } 50% { opacity: 1; transform: scale(1.15); } }
</style>
</head>
<body>
  <div class="card">
    <h1>MEMORY UNIVERSE</h1>
    <p>正在唤醒本地数据服务…</p>
    <div class="dot"></div>
  </div>
</body>
</html>`
  void window.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html))
}

function loadApp(window: BrowserWindow): void {
  showingLoadError = false
  appUrlReady = true
  loadAttempts += 1
  log('window', `加载页面（第 ${loadAttempts}/${MAX_LOAD_ATTEMPTS} 次）: ${APP_URL}`)
  void window.loadURL(APP_URL).catch((error: unknown) => {
    log('window', `loadURL 调用失败: ${String(error)}`)
  })
}

function frontendRoot(): string {
  const packagedRoot = path.join(process.resourcesPath, 'frontend')
  const localRoot = path.resolve(__dirname, '../../frontend/dist')
  return fs.existsSync(path.join(packagedRoot, 'index.html')) ? packagedRoot : localRoot
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function startServices(): Promise<void> {
  let backendOrigin = process.env.MU_BACKEND_URL || ''
  if (!backendOrigin) {
    backendHandle = await startBackend({ onUnexpectedExit: handleBackendExit })
    backendOrigin = backendHandle.origin
  } else {
    log('backend', `使用外部后端: ${backendOrigin}`)
  }

  const root = frontendRoot()
  staticServer = await startStaticServer({
    rootDir: root,
    backendUrl: backendOrigin,
    csp: CSP
  })
  APP_URL = staticServer.origin
  APP_ORIGIN = new URL(APP_URL).origin
  log('static', `生产静态服务已启动: ${APP_URL} root=${root}`)
}

async function stopServices(): Promise<void> {
  const handle = backendHandle
  backendHandle = null
  if (handle) {
    try {
      const result = await Promise.race([handle.stop(), wait(20_000).then(() => 'timeout' as const)])
      if (result === 'timeout') {
        log('app', '等待后端退出超时，继续退出流程')
      }
    } catch (error) {
      log('app', `停止后端失败: ${String(error)}`)
    }
  }

  const server = staticServer
  staticServer = null
  if (server) {
    try {
      await server.close()
    } catch (error) {
      log('static', `关闭静态服务失败: ${String(error)}`)
    }
  }
}

function handleBackendExit(code: number | null, signal: string | null): void {
  log('app', `后端意外退出 code=${code} signal=${signal ?? '(none)'}`)
  if (isQuitting || shuttingDown) {
    return
  }
  if (autoRestarts < MAX_AUTO_RESTARTS) {
    autoRestarts += 1
    log('app', `尝试自动恢复本地数据服务（第 ${autoRestarts} 次，上限 ${MAX_AUTO_RESTARTS} 次）`)
    void recoverBackend()
    return
  }
  if (mainWindow && !mainWindow.isDestroyed()) {
    log('app', '自动恢复次数已达上限，显示错误页')
    showStartupError(
      mainWindow,
      `本地数据服务意外退出（code=${code ?? 'unknown'}），自动恢复未成功`
    )
  }
}

async function restartServices(): Promise<void> {
  log('app', '重启本地服务：清理旧进程与旧静态服务')
  await stopServices()
  await cleanupOrphanProcesses()
  await startServices()
}

async function recoverBackend(): Promise<void> {
  if (recovering || shuttingDown) {
    return
  }
  recovering = true
  try {
    if (mainWindow && !mainWindow.isDestroyed()) {
      loadSplash(mainWindow)
    }
    await restartServices()
    if (mainWindow && !mainWindow.isDestroyed()) {
      loadApp(mainWindow)
    }
    log('app', '本地数据服务已自动恢复')
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    log('app', `自动恢复失败: ${message}`)
    if (mainWindow && !mainWindow.isDestroyed()) {
      showStartupError(mainWindow, `自动恢复失败：${message}`)
    }
  } finally {
    recovering = false
  }
}

async function manualRestart(): Promise<{ ok: boolean; error?: string }> {
  if (shuttingDown) {
    return { ok: false, error: '应用正在退出' }
  }
  if (recovering) {
    return { ok: false, error: '服务正在重启，请稍候' }
  }
  if (manualRestarts >= MAX_MANUAL_RESTARTS) {
    return { ok: false, error: '已达到本次运行的最大重启次数，请退出应用后重新打开' }
  }
  manualRestarts += 1
  recovering = true
  log('app', `用户手动重新启动服务（第 ${manualRestarts} 次，上限 ${MAX_MANUAL_RESTARTS} 次）`)
  const window = mainWindow
  try {
    if (window && !window.isDestroyed()) {
      loadSplash(window)
    }
    await restartServices()
    if (window && !window.isDestroyed()) {
      loadApp(window)
    }
    log('app', '手动重启成功，已重新获取动态端口并通过健康检查')
    return { ok: true }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    log('app', `手动重启失败: ${message}`)
    if (window && !window.isDestroyed()) {
      showStartupError(window, `重新启动失败：${message}`)
    }
    return { ok: false, error: message }
  } finally {
    recovering = false
  }
}

async function beginShutdown(): Promise<void> {
  if (shuttingDown) {
    return
  }
  shuttingDown = true
  isQuitting = true
  log('app', '开始退出流程：请求本地数据服务优雅关闭')
  await stopServices()
  log('app', '本地服务已停止，退出应用')
  app.quit()
}

function createWindow(): BrowserWindow | null {
  if (mainWindow && !mainWindow.isDestroyed()) {
    log('window', '主窗口已存在，改为聚焦，避免重复创建')
    if (mainWindow.isMinimized()) {
      mainWindow.restore()
    }
    mainWindow.focus()
    return mainWindow
  }

  const state = loadWindowState()
  loadAttempts = 0
  showingLoadError = false
  appUrlReady = false
  log('window', `创建主窗口 bounds=${state.width}x${state.height} maximized=${state.maximized}`)
  const window = new BrowserWindow({
    width: state.width,
    height: state.height,
    x: state.x,
    y: state.y,
    minWidth: MIN_WIDTH,
    minHeight: MIN_HEIGHT,
    useContentSize: true,
    show: false,
    backgroundColor: '#050816',
    title: 'Memory Universe · 时光收藏馆',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webviewTag: false,
      spellcheck: false,
      webSecurity: true
    }
  })
  mainWindow = window
  let shown = false

  if (state.maximized) {
    window.maximize()
  }

  window.once('ready-to-show', () => {
    if (shown || window.isDestroyed()) {
      return
    }
    shown = true
    window.show()
    log('window', '主窗口已显示')
  })

  window.on('show', () => log('window', 'show 事件'))
  window.on('hide', () => log('window', 'hide 事件'))
  window.on('focus', () => log('window', '获得焦点'))
  window.on('blur', () => log('window', '失去焦点'))
  window.on('restore', () => log('window', '窗口恢复'))
  window.on('minimize', () => log('window', '窗口最小化'))
  window.on('maximize', () => log('window', '窗口最大化'))
  window.on('unmaximize', () => log('window', '窗口还原'))
  window.on('unresponsive', () => log('window', '窗口无响应'))
  window.on('closed', () => {
    log('window', '主窗口已关闭')
    mainWindow = null
  })

  window.webContents.on('preload-error', (_event, preloadPath, error) => {
    log('preload', `加载失败 ${preloadPath}: ${error.message}`)
  })
  window.webContents.on('dom-ready', () => log('window', 'DOM 已就绪'))
  window.webContents.on('did-finish-load', () => log('window', '页面加载完成'))
  window.webContents.on('render-process-gone', (_event, details) => {
    log('window', `渲染进程退出 reason=${details.reason} exitCode=${details.exitCode}`)
  })
  window.webContents.on('console-message', (details) => {
    if (details.level === 'error' || details.level === 'warning') {
      log('renderer', `[${details.level}] ${details.message} (${details.sourceId}:${details.lineNumber})`)
    }
  })

  const initialContent = window.getContentBounds()
  let normalContentSize = {
    width: initialContent.width >= MIN_VALID_SIZE ? initialContent.width : 1440,
    height: initialContent.height >= MIN_VALID_SIZE ? initialContent.height : 900
  }
  const rememberContentSize = () => {
    if (window.isMaximized() || window.isFullScreen() || window.isMinimized()) {
      return
    }
    const bounds = window.getContentBounds()
    if (bounds.width >= MIN_VALID_SIZE && bounds.height >= MIN_VALID_SIZE) {
      normalContentSize = { width: bounds.width, height: bounds.height }
    }
  }
  const scheduleSave = () => {
    clearTimeout(saveTimer)
    saveTimer = setTimeout(() => {
      rememberContentSize()
      saveWindowState(window, normalContentSize)
    }, 400)
  }
  window.on('resize', scheduleSave)
  window.on('move', scheduleSave)
  window.on('close', (event) => {
    clearTimeout(saveTimer)
    rememberContentSize()
    saveWindowState(window, normalContentSize)
    if (shuttingDown) {
      return
    }
    // 先阻止立即退出，等后端优雅关闭完成后再真正关闭窗口。
    event.preventDefault()
    void beginShutdown()
  })

  // 退出全屏/最小化恢复后，若内容尺寸异常，回退到最近一次有效尺寸，避免窗口变成不可见的小条。
  window.on('leave-full-screen', () => {
    if (window.isDestroyed()) {
      return
    }
    const bounds = window.getContentBounds()
    if (bounds.width < MIN_VALID_SIZE || bounds.height < MIN_VALID_SIZE) {
      window.setContentSize(normalContentSize.width, normalContentSize.height)
      log('window', `退出全屏后恢复内容尺寸 ${normalContentSize.width}x${normalContentSize.height}`)
    }
  })
  window.on('restore', () => {
    if (window.isDestroyed()) {
      return
    }
    const bounds = window.getContentBounds()
    if (bounds.width < MIN_VALID_SIZE || bounds.height < MIN_VALID_SIZE) {
      window.setContentSize(normalContentSize.width, normalContentSize.height)
      log('window', `窗口恢复后修正内容尺寸 ${normalContentSize.width}x${normalContentSize.height}`)
    }
  })

  window.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') {
      return
    }
    if (input.key === 'F11') {
      event.preventDefault()
      window.setFullScreen(!window.isFullScreen())
    } else if (input.key === 'Escape' && window.isFullScreen()) {
      event.preventDefault()
      window.setFullScreen(false)
    } else if (input.key === 'F12' && IS_DEV) {
      event.preventDefault()
      window.webContents.toggleDevTools()
    }
  })

  window.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) {
      void shell.openExternal(url)
    }
    return { action: 'deny' }
  })

  window.webContents.on('will-navigate', (event, url) => {
    if (isAllowedNavigation(url)) {
      return
    }
    event.preventDefault()
    if (/^https?:\/\//i.test(url)) {
      void shell.openExternal(url)
    }
  })

  window.webContents.on('will-redirect', (event, url) => {
    if (!isAllowedNavigation(url)) {
      event.preventDefault()
    }
  })

  window.webContents.on('will-attach-webview', (event) => {
    event.preventDefault()
  })

  window.webContents.on('did-fail-load', (_event, errorCode, errorDescription, failedUrl, isMainFrame) => {
    if (!isMainFrame || errorCode === -3 || !appUrlReady) {
      return
    }
    log('window', `页面加载失败 code=${errorCode} desc=${errorDescription} url=${failedUrl}`)
    if (loadAttempts < MAX_LOAD_ATTEMPTS) {
      setTimeout(() => {
        if (!window.isDestroyed()) {
          loadApp(window)
        }
      }, 1200)
      return
    }
    log('window', '已达到最大重试次数，显示错误页')
    showLoadError(window, `${errorDescription} (${errorCode})`)
  })

  // 兜底：仅当窗口从未显示过时才补一次 show，避免把用户主动最小化的窗口重新弹出来。
  setTimeout(() => {
    if (!window.isDestroyed() && !shown) {
      shown = true
      window.show()
      log('window', '兜底显示主窗口（ready-to-show 未触发）')
    }
  }, 5000)

  return window
}

const hasSingleInstanceLock = app.requestSingleInstanceLock()
log('app', `单实例锁=${hasSingleInstanceLock}`)

if (!hasSingleInstanceLock) {
  log('app', '已有实例在运行，当前进程退出')
  app.quit()
} else {
  app.on('second-instance', () => {
    log('app', '检测到重复启动，聚焦已有窗口')
    if (!mainWindow) {
      log('app', '未找到现有窗口，重新创建')
      const window = createWindow()
      if (window) {
        if (IS_DEV || appUrlReady) {
          loadApp(window)
        } else {
          loadSplash(window)
        }
      }
      return
    }
    if (mainWindow.isMinimized()) {
      mainWindow.restore()
    }
    if (!mainWindow.isVisible()) {
      mainWindow.show()
    }
    mainWindow.focus()
  })

  app.on('child-process-gone', (_event, details) => {
    log('app', `子进程退出 type=${details.type} reason=${details.reason} exitCode=${details.exitCode}`)
  })

  app.on('before-quit', (event) => {
    if (shuttingDown) {
      isQuitting = true
      return
    }
    event.preventDefault()
    void beginShutdown()
  })
  app.on('quit', () => {
    log('app', '应用已退出')
    closeLog()
  })

  app.whenReady().then(async () => {
    log('app', 'Electron 已就绪')
    app.setAppUserModelId('com.memoryuniverse.desktop')
    Menu.setApplicationMenu(null)

    session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => {
      callback(false)
    })
    session.defaultSession.setPermissionCheckHandler(() => false)

    applyProductionCsp()
    registerIpc()

    const window = createWindow()
    if (!window) {
      return
    }

    if (IS_DEV) {
      loadApp(window)
      log('app', '开发模式启动完成')
      return
    }

    loadSplash(window)
    try {
      await cleanupOrphanProcesses()
      await startServices()
      loadApp(window)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      log('app', `生产启动失败: ${message}`)
      showStartupError(window, message)
      await stopServices()
    }
    log('app', '启动流程完成')
  }).catch((error: unknown) => {
    log('app', `启动失败: ${String(error)}`)
  })

  app.on('window-all-closed', () => {
    log('app', '所有窗口已关闭')
    if (shuttingDown) {
      return
    }
    void beginShutdown()
  })
}
