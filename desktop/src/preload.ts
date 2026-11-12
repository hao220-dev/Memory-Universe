import { contextBridge, ipcRenderer } from 'electron'

const desktopApi = Object.freeze({
  getAppInfo: () => ipcRenderer.invoke('app:get-info'),
  openDataDirectory: () => ipcRenderer.invoke('app:open-data-directory'),
  openLogDirectory: () => ipcRenderer.invoke('app:open-log-directory'),
  quit: () => ipcRenderer.invoke('app:quit'),
  backend: Object.freeze({
    restart: () => ipcRenderer.invoke('backend:restart')
  }),
  window: Object.freeze({
    minimize: () => ipcRenderer.invoke('window:minimize'),
    toggleMaximize: () => ipcRenderer.invoke('window:toggle-maximize'),
    close: () => ipcRenderer.invoke('window:close'),
    toggleFullscreen: () => ipcRenderer.invoke('window:toggle-fullscreen'),
    isMaximized: () => ipcRenderer.invoke('window:is-maximized')
  })
})

contextBridge.exposeInMainWorld('desktop', desktopApi)
