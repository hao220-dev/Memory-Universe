import { app } from 'electron'
import path from 'node:path'
import { RotatingFile } from './log-rotate'

let writer: RotatingFile | null = null
let consoleBroken = false
let closed = false

export function logDirectory(): string {
  return path.join(app.getPath('userData'), 'logs')
}

function ensureWriter(): RotatingFile | null {
  if (closed) {
    return null
  }
  if (!writer) {
    writer = new RotatingFile(path.join(logDirectory(), 'main.log'))
  }
  return writer
}

/**
 * 主进程日志。终端/管道被关闭时 stdout 会抛 EBADF，
 * 因此文件与控制台写入都必须容错，不能让日志本身导致进程崩溃。
 */
export function log(scope: string, message: string): void {
  if (closed) {
    return
  }
  const line = `[${new Date().toISOString()}] [${scope}] ${message}`

  try {
    ensureWriter()?.write(`${line}\n`)
  } catch {
    // 忽略文件写入失败
  }

  if (!consoleBroken) {
    try {
      console.log(line)
    } catch {
      consoleBroken = true
    }
  }
}

export function closeLog(): void {
  closed = true
  try {
    writer?.close()
  } catch {
    // 忽略重复关闭
  }
  writer = null
}
