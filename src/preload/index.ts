import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron'

export interface WPMStats {
  wpm: number
  charCount: number
  timeWindowMs: number
}

export interface ElectronAPI {
  subscribeToWPM: (callback: (stats: WPMStats) => void) => () => void
}

contextBridge.exposeInMainWorld('electronAPI', {
  subscribeToWPM: (callback: (stats: WPMStats) => void) => {
    const handler = (_event: IpcRendererEvent, stats: WPMStats) => callback(stats)
    ipcRenderer.on('wpm:update', handler)
    return () => ipcRenderer.removeListener('wpm:update', handler)
  },
})
