import fs from 'node:fs'
import path from 'node:path'

const DEFAULT_MAX_BYTES = 10 * 1024 * 1024
const DEFAULT_MAX_FILES = 5

function readLimit(value: string | undefined, fallback: number): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback
}

export interface RotatingFileOptions {
  maxBytes?: number
  maxFiles?: number
}

/**
 * 带大小轮转的追加日志写入器。
 * - 达到 maxBytes 后把 file 重命名为 file.1，依次后移，最多保留 maxFiles 个历史文件；
 * - 所有文件操作都容错，写入失败只会停止写日志，不会让主进程崩溃（避免再次出现 EBADF）；
 * - 不在日志中记录任何调用方传入内容以外的信息。
 */
export class RotatingFile {
  private readonly file: string
  private readonly maxBytes: number
  private readonly maxFiles: number
  private stream: fs.WriteStream | null = null
  private size = 0
  private broken = false
  private closed = false

  constructor(file: string, options: RotatingFileOptions = {}) {
    this.file = file
    this.maxBytes = readLimit(process.env.MU_LOG_MAX_BYTES, options.maxBytes ?? DEFAULT_MAX_BYTES)
    this.maxFiles = readLimit(process.env.MU_LOG_MAX_FILES, options.maxFiles ?? DEFAULT_MAX_FILES)
  }

  get path(): string {
    return this.file
  }

  write(text: string): void {
    if (this.closed || this.broken) {
      return
    }
    try {
      const data = Buffer.from(text, 'utf8')
      if (!this.ensureStream()) {
        return
      }
      if (this.size > 0 && this.size + data.length > this.maxBytes) {
        this.rotate()
        if (!this.ensureStream()) {
          return
        }
      }
      const target = this.stream
      if (!target || target.destroyed || target.writableEnded) {
        return
      }
      target.write(data)
      this.size += data.length
    } catch {
      this.broken = true
    }
  }

  close(): void {
    this.closed = true
    try {
      this.stream?.end()
    } catch {
      // 已关闭
    }
    this.stream = null
  }

  private ensureStream(): boolean {
    if (this.stream && !this.stream.destroyed && !this.stream.writableEnded) {
      return true
    }
    try {
      fs.mkdirSync(path.dirname(this.file), { recursive: true })
      this.size = fs.existsSync(this.file) ? fs.statSync(this.file).size : 0
      const next = fs.createWriteStream(this.file, { flags: 'a' })
      next.on('error', () => {
        if (this.stream === next) {
          this.stream = null
          this.broken = true
        }
      })
      this.stream = next
      return true
    } catch {
      this.broken = true
      return false
    }
  }

  private rotate(): void {
    try {
      this.stream?.end()
    } catch {
      // 忽略
    }
    this.stream = null
    try {
      const oldest = `${this.file}.${this.maxFiles}`
      if (fs.existsSync(oldest)) {
        fs.rmSync(oldest, { force: true })
      }
      for (let index = this.maxFiles - 1; index >= 1; index -= 1) {
        const from = `${this.file}.${index}`
        if (fs.existsSync(from)) {
          fs.renameSync(from, `${this.file}.${index + 1}`)
        }
      }
      if (fs.existsSync(this.file)) {
        fs.renameSync(this.file, `${this.file}.1`)
      }
      this.size = 0
    } catch {
      this.broken = true
    }
  }
}
