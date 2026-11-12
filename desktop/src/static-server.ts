import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.m4a': 'audio/mp4',
  '.aac': 'audio/aac',
  '.flac': 'audio/flac',
  '.opus': 'audio/ogg',
  '.map': 'application/json; charset=utf-8'
}

export interface StaticServerOptions {
  rootDir: string
  backendUrl: string
  csp: string
}

export interface StaticServer {
  origin: string
  close: () => Promise<void>
}

function sendJson(response: http.ServerResponse, status: number, payload: unknown): void {
  const body = JSON.stringify(payload)
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  })
  response.end(body)
}

function proxy(
  request: http.IncomingMessage,
  response: http.ServerResponse,
  backendUrl: string
): void {
  const target = new URL(request.url || '/', backendUrl)
  const headers = { ...request.headers }
  // 去掉会触发后端 CORS 校验的来源头；代理后浏览器看到的是同源响应。
  delete headers.origin
  delete headers.referer
  headers.host = target.host

  const upstream = http.request(
    target,
    { method: request.method, headers },
    (upstreamResponse) => {
      response.writeHead(upstreamResponse.statusCode || 502, upstreamResponse.headers)
      upstreamResponse.pipe(response)
    }
  )
  upstream.on('error', () => {
    if (!response.headersSent) {
      sendJson(response, 503, {
        code: 503,
        message: '本地数据服务未启动',
        data: null,
        timestamp: Date.now()
      })
    } else {
      response.end()
    }
  })
  request.pipe(upstream)
}

function serveFile(
  filePath: string,
  request: http.IncomingMessage,
  response: http.ServerResponse,
  csp: string
): void {
  const extension = path.extname(filePath).toLowerCase()
  const headers: Record<string, string> = {
    'Content-Type': MIME[extension] || 'application/octet-stream',
    'X-Content-Type-Options': 'nosniff'
  }
  if (filePath.endsWith('index.html')) {
    headers['Cache-Control'] = 'no-store'
    headers['Content-Security-Policy'] = csp
  } else if (filePath.includes(`${path.sep}assets${path.sep}`)) {
    headers['Cache-Control'] = 'public, max-age=31536000, immutable'
  } else {
    headers['Cache-Control'] = 'no-cache'
  }
  response.writeHead(200, headers)
  if (request.method === 'HEAD') {
    response.end()
    return
  }
  fs.createReadStream(filePath)
    .on('error', () => {
      response.destroy()
    })
    .pipe(response)
}

export async function startStaticServer(options: StaticServerOptions): Promise<StaticServer> {
  const root = path.resolve(options.rootDir)
  const indexFile = path.join(root, 'index.html')
  if (!fs.existsSync(indexFile)) {
    throw new Error(`前端构建产物不存在: ${indexFile}`)
  }

  const server = http.createServer((request, response) => {
    const url = new URL(request.url || '/', 'http://127.0.0.1')
    const pathname = decodeURIComponent(url.pathname)

    if (pathname === '/api' || pathname.startsWith('/api/') || pathname.startsWith('/media/')) {
      proxy(request, response, options.backendUrl)
      return
    }

    let filePath = path.join(root, pathname)
    if (filePath !== root && !filePath.startsWith(root + path.sep)) {
      response.writeHead(403)
      response.end('Forbidden')
      return
    }

    fs.stat(filePath, (error, stat) => {
      if (error || !stat.isFile()) {
        if (path.extname(pathname)) {
          response.writeHead(404)
          response.end('Not found')
          return
        }
        filePath = indexFile
      }
      serveFile(filePath, request, response, options.csp)
    })
  })

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      server.off('error', reject)
      resolve()
    })
  })

  const address = server.address()
  if (!address || typeof address === 'string') {
    server.close()
    throw new Error('无法分配本地静态服务端口')
  }

  return {
    origin: `http://127.0.0.1:${address.port}`,
    close: () =>
      new Promise((resolve) => {
        server.close(() => resolve())
        // 退出时主动断开 keep-alive 连接，避免关闭静态服务时卡住。
        server.closeAllConnections?.()
      })
  }
}
