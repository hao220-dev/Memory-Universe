import { app, safeStorage } from 'electron'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { log } from './logger'

interface SecretFile {
  version: number
  jwtSecret: string
  adminPassword?: string
}

export interface AppSecrets {
  jwtSecret: string
  /**
   * 仅当通过环境变量 MU_ADMIN_PASSWORD 显式指定时才存在。
   * 桌面端不再内置可直接使用的默认管理员口令，首次密码由用户在馆长登录页设置。
   */
  adminPassword?: string
}

function secretFile(): string {
  return path.join(app.getPath('userData'), 'config', 'secrets.json')
}

function encode(value: string): string {
  if (safeStorage.isEncryptionAvailable()) {
    return `enc:${safeStorage.encryptString(value).toString('base64')}`
  }
  return `raw:${Buffer.from(value, 'utf8').toString('base64')}`
}

function decode(value: string | undefined): string | null {
  if (!value) {
    return null
  }
  try {
    if (value.startsWith('enc:')) {
      return safeStorage.decryptString(Buffer.from(value.slice(4), 'base64'))
    }
    if (value.startsWith('raw:')) {
      return Buffer.from(value.slice(4), 'base64').toString('utf8')
    }
  } catch {
    return null
  }
  return null
}

function writeSecretFile(secrets: AppSecrets): void {
  const file = secretFile()
  fs.mkdirSync(path.dirname(file), { recursive: true })
  const payload: SecretFile = {
    version: 1,
    jwtSecret: encode(secrets.jwtSecret)
  }
  if (secrets.adminPassword) {
    payload.adminPassword = encode(secrets.adminPassword)
  }
  fs.writeFileSync(file, JSON.stringify(payload), { encoding: 'utf8', mode: 0o600 })
}

/**
 * 敏感配置只保存在本机用户数据目录，优先使用系统安全存储加密；
 * 通过环境变量传给后端进程，不写入命令行参数、日志、前端或仓库。
 *
 * 兼容旧版本 secrets.json：其中已有的 jwtSecret 与 adminPassword 会继续沿用，
 * 不会被重置，因此已安装用户的管理员密码与登录状态不受影响。
 */
export function loadSecrets(): AppSecrets {
  const file = secretFile()
  let jwtSecret = ''
  let adminPassword = process.env.MU_ADMIN_PASSWORD || ''

  try {
    if (fs.existsSync(file)) {
      const parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as SecretFile
      jwtSecret = decode(parsed.jwtSecret) || ''
      if (!adminPassword) {
        adminPassword = decode(parsed.adminPassword) || ''
      }
    }
  } catch (error) {
    log('secrets', `读取本机密钥失败，将重新生成: ${String(error)}`)
  }

  let changed = false
  if (jwtSecret.length < 32) {
    jwtSecret = crypto.randomBytes(36).toString('base64url')
    changed = true
    log('secrets', `已生成本机 JWT 密钥 safeStorage=${safeStorage.isEncryptionAvailable()}`)
  }

  if (changed) {
    try {
      writeSecretFile({ jwtSecret, adminPassword: adminPassword || undefined })
    } catch (error) {
      log('secrets', `保存本机密钥失败，本次使用临时配置: ${String(error)}`)
    }
  }

  const secrets: AppSecrets = { jwtSecret }
  if (adminPassword) {
    secrets.adminPassword = adminPassword
  }
  return secrets
}
