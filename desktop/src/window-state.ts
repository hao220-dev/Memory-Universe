import { app, screen, type BrowserWindow } from 'electron'
import fs from 'node:fs'
import path from 'node:path'

export interface WindowState {
  width: number
  height: number
  x?: number
  y?: number
  maximized: boolean
}

export const MIN_WIDTH = 1024
export const MIN_HEIGHT = 650

const DEFAULT_STATE: WindowState = {
  width: 1440,
  height: 900,
  maximized: false
}

function stateFile(): string {
  return path.join(app.getPath('userData'), 'window-state.json')
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function restoreBounds(state: WindowState): WindowState {
  const visible = screen.getAllDisplays().some((display) => {
    const area = display.workArea
    return (
      state.x !== undefined &&
      state.y !== undefined &&
      state.x < area.x + area.width &&
      state.x + state.width > area.x &&
      state.y < area.y + area.height &&
      state.y + state.height > area.y
    )
  })

  if (!visible) {
    delete state.x
    delete state.y
  }
  return state
}

export function loadWindowState(): WindowState {
  try {
    const raw = fs.readFileSync(stateFile(), 'utf8')
    const parsed = JSON.parse(raw) as Partial<WindowState>
    if (
      !isFiniteNumber(parsed.width) ||
      !isFiniteNumber(parsed.height) ||
      parsed.width < MIN_WIDTH ||
      parsed.height < MIN_HEIGHT
    ) {
      return { ...DEFAULT_STATE }
    }

    const state: WindowState = {
      width: Math.round(parsed.width),
      height: Math.round(parsed.height),
      maximized: parsed.maximized === true
    }
    if (isFiniteNumber(parsed.x) && isFiniteNumber(parsed.y)) {
      state.x = Math.round(parsed.x)
      state.y = Math.round(parsed.y)
    }
    return restoreBounds(state)
  } catch {
    return { ...DEFAULT_STATE }
  }
}

export function saveWindowState(
  window: BrowserWindow,
  contentSize: { width: number; height: number }
): void {
  try {
    const width = Math.round(contentSize.width)
    const height = Math.round(contentSize.height)
    // 最小化/全屏切换/关闭过程中可能读到 0×0 或图标尺寸，不能写入状态文件。
    if (!Number.isFinite(width) || !Number.isFinite(height) || width < 400 || height < 400) {
      return
    }
    const bounds = window.getNormalBounds()
    const state: WindowState = {
      width,
      height,
      x: bounds.x,
      y: bounds.y,
      maximized: window.isMaximized()
    }
    fs.writeFileSync(stateFile(), JSON.stringify(state), 'utf8')
  } catch {
    // 窗口状态写入失败不应影响应用退出
  }
}
