import { app } from 'electron'
import crypto from 'node:crypto'
import fs from 'node:fs'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import { execFile, spawn, type ChildProcess } from 'node:child_process'
import { log } from './logger'
import { RotatingFile } from './log-rotate'
import { loadSecrets } from './secrets'

const STARTUP_TIMEOUT_MS = 60_000
const HEALTH_INTERVAL_MS = 500
const INFO_INTERVAL_MS = 250
const SHUTDOWN_TIMEOUT_MS = 10_000
const ORPHAN_SHUTDOWN_WAIT_MS = 8_000
const RUN_DIR_PREFIX = 'memory-universe-run-'
const APP_MARKER = '-DMU_DESKTOP_APP=memory-universe'

export interface StartBackendOptions {
  onUnexpectedExit?: (code: number | null, signal: string | null) => void
}

export interface BackendHandle {
  origin: string
  port: number
  stop: () => Promise<void>
}

interface RuntimeInfo {
  bootId: string
  port: number
}

interface BackendIdentity {
  version: number
  bootId: string
  pid: number
  port: number
  runDir: string
  javaPath: string
  jarPath: string
  startedAt: string
  shutdownToken: string
}

interface ProcessDetails {
  name: string
  executablePath: string
  commandLine: string
}

interface BackendFiles {
  java: string
  jar: string
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function identityFile(): string {
  return path.join(app.getPath('userData'), 'runtime', 'backend-process.json')
}

function ensureDirectories(base: string): void {
  const dirs = [
    path.join(base, 'data', 'db'),
    path.join(base, 'uploads', 'photos'),
    path.join(base, 'uploads', 'music'),
    path.join(base, 'logs'),
    path.join(base, 'config'),
    path.join(base, 'runtime')
  ]
  for (const dir of dirs) {
    fs.mkdirSync(dir, { recursive: true })
  }
}

function resolveBackendFiles(): BackendFiles {
  const roots = [
    process.env.MU_RESOURCES_DIR,
    path.join(process.resourcesPath, 'resources'),
    process.resourcesPath,
    path.resolve(__dirname, '..', 'resources')
  ].filter((value): value is string => Boolean(value))

  for (const root of roots) {
    const javaCandidates = [
      path.join(root, 'runtime', 'bin', 'javaw.exe'),
      path.join(root, 'runtime', 'bin', 'java.exe')
    ]
    const java = javaCandidates.find((candidate) => fs.existsSync(candidate))
    const jar = path.join(root, 'backend', 'memory-universe-backend.jar')
    if (java && fs.existsSync(jar)) {
      return { java, jar }
    }
  }

  throw new Error('未找到内置 Java 运行时或后端 JAR，请检查 resources/runtime 与 resources/backend')
}

function readRuntimeInfo(file: string, bootId: string): RuntimeInfo | null {
  try {
    if (!fs.existsSync(file)) {
      return null
    }
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as Partial<RuntimeInfo>
    if (parsed.bootId !== bootId) {
      return null
    }
    const port = Number(parsed.port)
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      return null
    }
    return { bootId, port }
  } catch {
    return null
  }
}

function checkHealth(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const request = http.get(
      { host: '127.0.0.1', port, path: '/api/health', timeout: 1500 },
      (response) => {
        let body = ''
        response.setEncoding('utf8')
        response.on('data', (chunk: string) => {
          body += chunk
        })
        response.on('end', () => {
          try {
            const parsed = JSON.parse(body) as { code?: number }
            resolve(response.statusCode === 200 && parsed.code === 0)
          } catch {
            resolve(false)
          }
        })
      }
    )
    request.on('timeout', () => {
      request.destroy()
      resolve(false)
    })
    request.on('error', () => resolve(false))
  })
}

function requestGracefulShutdown(port: number, token: string): Promise<boolean> {
  return new Promise((resolve) => {
    const body = Buffer.from('{}', 'utf8')
    const request = http.request(
      {
        host: '127.0.0.1',
        port,
        path: '/api/internal/shutdown',
        method: 'POST',
        timeout: 3000,
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': body.length,
          'X-MU-Shutdown-Token': token
        }
      },
      (response) => {
        response.resume()
        response.on('end', () => resolve(response.statusCode === 202 || response.statusCode === 200))
      }
    )
    request.on('timeout', () => {
      request.destroy()
      resolve(false)
    })
    request.on('error', () => resolve(false))
    request.end(body)
  })
}

function waitForExit(child: ChildProcess, timeoutMs: number): Promise<boolean> {
  if (child.exitCode !== null) {
    return Promise.resolve(true)
  }
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      child.off('exit', onExit)
      resolve(false)
    }, timeoutMs)
    const onExit = () => {
      clearTimeout(timer)
      resolve(true)
    }
    child.once('exit', onExit)
  })
}

/**
 * 通过 WMI/CIM 查询进程真实路径与启动参数，用于确认进程身份，避免 PID 复用误杀其他 Java 程序。
 */
function queryProcess(pid: number): Promise<ProcessDetails | null> {
  return new Promise((resolve) => {
    const script =
      `$p = Get-CimInstance Win32_Process -Filter "ProcessId=${pid}" -ErrorAction SilentlyContinue; ` +
      `if ($p) { $p | Select-Object Name, ExecutablePath, CommandLine | ConvertTo-Json -Compress }`
    execFile(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-Command', script],
      { windowsHide: true, timeout: 6000 },
      (error, stdout) => {
        if (error || !stdout.trim()) {
          resolve(null)
          return
        }
        try {
          const parsed = JSON.parse(stdout.trim()) as {
            Name?: string
            ExecutablePath?: string
            CommandLine?: string
          }
          resolve({
            name: String(parsed.Name || ''),
            executablePath: String(parsed.ExecutablePath || ''),
            commandLine: String(parsed.CommandLine || '')
          })
        } catch {
          resolve(null)
        }
      }
    )
  })
}

function samePath(left: string, right: string): boolean {
  if (!left || !right) {
    return false
  }
  return path.resolve(left).toLowerCase() === path.resolve(right).toLowerCase()
}

function verifyProcessIdentity(details: ProcessDetails, identity: BackendIdentity): boolean {
  const name = details.name.toLowerCase()
  if (name !== 'javaw.exe' && name !== 'java.exe') {
    return false
  }
  if (!samePath(details.executablePath, identity.javaPath)) {
    return false
  }
  const commandLine = details.commandLine
  return (
    commandLine.includes(identity.jarPath) &&
    commandLine.includes(`-DMU_BOOT_ID=${identity.bootId}`) &&
    commandLine.includes(APP_MARKER)
  )
}

function forceKillVerified(pid: number): void {
  try {
    execFile('taskkill', ['/PID', String(pid), '/T', '/F'], { windowsHide: true }, () => {
      log('backend', `已强制终止确认属于本应用的后端进程 pid=${pid}`)
    })
  } catch (error) {
    log('backend', `强制终止失败 pid=${pid}: ${String(error)}`)
  }
}

async function waitForPidGone(pid: number, timeoutMs: number): Promise<boolean> {
  const startedAt = Date.now()
  while (Date.now() - startedAt < timeoutMs) {
    const details = await queryProcess(pid)
    if (!details) {
      return true
    }
    await delay(300)
  }
  return false
}

function readIdentity(): BackendIdentity | null {
  try {
    const parsed = JSON.parse(fs.readFileSync(identityFile(), 'utf8')) as Partial<BackendIdentity>
    const pid = Number(parsed.pid)
    const port = Number(parsed.port)
    if (!Number.isInteger(pid) || pid <= 0 || !Number.isInteger(port)) {
      return null
    }
    return {
      version: 1,
      bootId: String(parsed.bootId || ''),
      pid,
      port,
      runDir: String(parsed.runDir || ''),
      javaPath: String(parsed.javaPath || ''),
      jarPath: String(parsed.jarPath || ''),
      startedAt: String(parsed.startedAt || ''),
      shutdownToken: String(parsed.shutdownToken || '')
    }
  } catch {
    return null
  }
}

function writeIdentity(identity: BackendIdentity): void {
  try {
    const file = identityFile()
    fs.mkdirSync(path.dirname(file), { recursive: true })
    const temp = `${file}.tmp`
    fs.writeFileSync(temp, JSON.stringify(identity), { encoding: 'utf8', mode: 0o600 })
    fs.renameSync(temp, file)
  } catch (error) {
    log('backend', `写入后端身份文件失败: ${String(error)}`)
  }
}

function removeIdentity(): void {
  try {
    fs.rmSync(identityFile(), { force: true })
  } catch {
    // 忽略
  }
}

/**
 * 只清理本应用创建的临时运行目录（memory-universe-run-*）。
 * 目录中仍有存活进程时保留，避免误删其他实例正在使用的运行信息。
 */
async function cleanupStaleRunDirs(activeDir?: string): Promise<void> {
  let entries: string[] = []
  try {
    entries = fs.readdirSync(os.tmpdir())
  } catch {
    return
  }
  for (const name of entries) {
    if (!name.startsWith(RUN_DIR_PREFIX)) {
      continue
    }
    const dir = path.join(os.tmpdir(), name)
    if (activeDir && path.resolve(dir) === path.resolve(activeDir)) {
      continue
    }
    let pid = 0
    try {
      const info = JSON.parse(fs.readFileSync(path.join(dir, 'backend.json'), 'utf8')) as { pid?: number }
      pid = Number(info.pid) || 0
    } catch {
      // 没有运行信息文件时按过期目录处理
    }
    if (pid > 0 && (await queryProcess(pid))) {
      log('backend', `保留可能仍在使用的临时目录 ${name} (pid=${pid})`)
      continue
    }
    try {
      fs.rmSync(dir, { recursive: true, force: true })
      log('backend', `已清理过期临时运行目录 ${name}`)
    } catch (error) {
      log('backend', `清理临时目录失败 ${name}: ${String(error)}`)
    }
  }
}

/**
 * 启动前清理上一次运行遗留的后端进程。
 * 必须同时验证 Java 路径、JAR 路径与启动时写入的 bootId 标记，全部匹配才允许终止。
 */
export async function cleanupOrphanProcesses(): Promise<void> {
  const identity = readIdentity()
  if (identity) {
    const details = await queryProcess(identity.pid)
    const verified = details ? verifyProcessIdentity(details, identity) : false
    log(
      'backend',
      `检查遗留后端进程 pid=${identity.pid} 存在=${Boolean(details)} 身份确认=${verified}`
    )
    if (verified) {
      log('backend', '尝试对遗留后端执行优雅关闭')
      const accepted = await requestGracefulShutdown(identity.port, identity.shutdownToken)
      const gone = accepted ? await waitForPidGone(identity.pid, ORPHAN_SHUTDOWN_WAIT_MS) : false
      if (!gone) {
        log('backend', '遗留后端未在超时内退出，执行受控强制终止')
        forceKillVerified(identity.pid)
        await waitForPidGone(identity.pid, 5000)
      }
      if (identity.runDir.startsWith(path.join(os.tmpdir(), RUN_DIR_PREFIX))) {
        try {
          fs.rmSync(identity.runDir, { recursive: true, force: true })
        } catch {
          // 目录可能已被后端删除
        }
      }
    } else if (details) {
      log('backend', '无法确认遗留进程身份，跳过自动清理，避免误杀其他 Java 程序')
    }
    removeIdentity()
  }
  await cleanupStaleRunDirs()
}

export async function startBackend(options: StartBackendOptions = {}): Promise<BackendHandle> {
  const userDataDir = app.getPath('userData')
  ensureDirectories(userDataDir)

  const files = resolveBackendFiles()
  const logFile = path.join(userDataDir, 'logs', 'backend.log')
  const logWriter = new RotatingFile(logFile)
  const appendLog = (chunk: Buffer | string) => {
    try {
      logWriter.write(chunk.toString())
    } catch {
      // 日志失败不影响后端运行
    }
  }

  const runDir = fs.mkdtempSync(path.join(os.tmpdir(), RUN_DIR_PREFIX))
  const infoFile = path.join(runDir, 'backend.json')
  const bootId = crypto.randomUUID()
  const shutdownToken = crypto.randomBytes(32).toString('base64url')
  const secrets = loadSecrets()

  const backendEnv: NodeJS.ProcessEnv = {
    ...process.env,
    MU_DATA_DIR: userDataDir,
    MU_RUNTIME_FILE: infoFile,
    MU_BOOT_ID: bootId,
    MU_SHUTDOWN_TOKEN: shutdownToken,
    JWT_SECRET: secrets.jwtSecret
  }
  // 仅在显式配置时传入初始管理员密码；否则由首次设置流程在界面创建。
  if (secrets.adminPassword) {
    backendEnv.ADMIN_PASSWORD = secrets.adminPassword
  }

  log('backend', `启动内置 JRE: ${files.java}`)
  log('backend', `后端 JAR: ${files.jar}`)
  log('backend', `数据目录: ${userDataDir}`)
  log('backend', `初始管理员密码: ${secrets.adminPassword ? '已配置' : '未配置，等待首次设置'}`)

  const child = spawn(
    files.java,
    [
      '-Dfile.encoding=UTF-8',
      APP_MARKER,
      `-DMU_BOOT_ID=${bootId}`,
      '-jar',
      files.jar,
      '--spring.profiles.active=desktop',
      '--server.address=127.0.0.1',
      '--server.port=0'
    ],
    {
      cwd: userDataDir,
      windowsHide: true,
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: backendEnv
    }
  )

  let spawnError: Error | null = null
  let ready = false
  let stopping = false
  const recentLines: string[] = []

  const consume = (chunk: Buffer | string) => {
    appendLog(chunk)
    const text = chunk.toString()
    for (const line of text.split(/\r?\n/)) {
      if (!line.trim()) {
        continue
      }
      recentLines.push(line)
      if (recentLines.length > 40) {
        recentLines.shift()
      }
    }
  }

  child.stdout?.on('data', consume)
  child.stderr?.on('data', consume)
  child.on('error', (error) => {
    spawnError = error
    log('backend', `后端进程错误: ${error.message}`)
  })
  child.on('exit', (code, signal) => {
    log('backend', `后端进程退出 code=${code} signal=${signal ?? '(none)'}`)
    if (!stopping && ready) {
      options.onUnexpectedExit?.(code, signal)
    }
  })

  const startedAt = Date.now()
  let port: number | null = null

  while (Date.now() - startedAt < STARTUP_TIMEOUT_MS) {
    if (spawnError) {
      break
    }
    if (child.exitCode !== null) {
      break
    }
    const info = readRuntimeInfo(infoFile, bootId)
    if (info) {
      port = info.port
      break
    }
    // 兜底：运行信息文件写入失败时，从 Spring Boot 日志识别实际端口。
    const match = /Tomcat started on port(?:\(s\))?:?\s*(\d+)/.exec(recentLines.join('\n'))
    if (match) {
      port = Number(match[1])
      break
    }
    await delay(INFO_INTERVAL_MS)
  }

  const getSpawnError = (): Error | null => spawnError

  if (port === null) {
    const spawnFailure = getSpawnError()
    const reason = spawnFailure
      ? `无法启动 Java 进程：${spawnFailure.message}`
      : child.exitCode !== null
        ? `后端进程提前退出，退出码 ${child.exitCode}`
        : '等待后端端口超时'
    log('backend', `启动失败: ${reason}`)
    for (const line of recentLines.slice(-12)) {
      log('backend', `  ${line}`)
    }
    try {
      child.kill()
    } catch {
      // 进程可能已退出
    }
    logWriter.close()
    fs.rmSync(runDir, { recursive: true, force: true })
    throw new Error(`${reason}（详见 ${logFile}）`)
  }

  log('backend', `后端已分配端口 ${port}，开始健康检查`)
  let healthy = false
  while (Date.now() - startedAt < STARTUP_TIMEOUT_MS) {
    if (spawnError || child.exitCode !== null) {
      break
    }
    if (await checkHealth(port)) {
      healthy = true
      break
    }
    await delay(HEALTH_INTERVAL_MS)
  }

  if (!healthy) {
    const spawnFailure = getSpawnError()
    const reason =
      spawnFailure || child.exitCode !== null ? '后端进程在健康检查期间退出' : '健康检查超时（60 秒）'
    log('backend', `健康检查失败: ${reason}`)
    try {
      child.kill()
    } catch {
      // 进程可能已退出
    }
    logWriter.close()
    fs.rmSync(runDir, { recursive: true, force: true })
    throw new Error(`${reason}（详见 ${logFile}）`)
  }

  ready = true
  const origin = `http://127.0.0.1:${port}`
  log('backend', `后端健康检查通过: ${origin}`)

  if (child.pid) {
    writeIdentity({
      version: 1,
      bootId,
      pid: child.pid,
      port,
      runDir,
      javaPath: files.java,
      jarPath: files.jar,
      startedAt: new Date().toISOString(),
      shutdownToken
    })
  }

  let stopPromise: Promise<void> | null = null
  const performStop = async (): Promise<void> => {
    stopping = true
    if (child.exitCode === null) {
      log('backend', '请求后端优雅关闭')
      const accepted = await requestGracefulShutdown(port, shutdownToken)
      if (!accepted) {
        log('backend', '优雅关闭请求未被接受，等待进程自行退出')
      }
      const exited = await waitForExit(child, SHUTDOWN_TIMEOUT_MS)
      if (!exited) {
        log('backend', '优雅关闭超时，强制终止本次后端进程')
        try {
          child.kill()
        } catch {
          // 进程可能已退出
        }
        const killed = await waitForExit(child, 3000)
        if (!killed) {
          log('backend', '后端进程仍未退出')
        }
      } else {
        log('backend', '后端已优雅退出')
      }
    }
    removeIdentity()
    logWriter.close()
    try {
      fs.rmSync(runDir, { recursive: true, force: true })
    } catch {
      // 临时目录清理失败不影响退出
    }
  }

  return {
    origin,
    port,
    stop: () => {
      if (!stopPromise) {
        stopPromise = performStop()
      }
      return stopPromise
    }
  }
}
