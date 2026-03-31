import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron'

export interface WPMStats {
  wpm: number
  charCount: number
  timeWindowMs: number
  smartColouring: boolean
  wpmTextSize: 'medium' | 'large'
}

export interface ElectronAPI {
  subscribeToWPM: (callback: (stats: WPMStats) => void) => () => void
  setLaunchAtLogin: (enabled: boolean) => void
  setShowMenuBarWpm: (enabled: boolean) => void
  setShowOverlay: (enabled: boolean) => void
  setOpacity: (opacity: number) => void
  setSmartColouring: (enabled: boolean) => void
  setGlobalShortcut: (shortcut: string) => Promise<boolean>
  getGlobalShortcut: () => Promise<string>
  setLockOverlayToDesktop: (enabled: boolean) => void
  setWpmTextSize: (size: 'medium' | 'large') => void
  resetAllSettings: () => void
}

contextBridge.exposeInMainWorld('electronAPI', {
  subscribeToWPM: (callback: (stats: WPMStats) => void) => {
    const handler = (_event: IpcRendererEvent, stats: WPMStats) => callback(stats)
    ipcRenderer.on('wpm:update', handler)
    return () => ipcRenderer.removeListener('wpm:update', handler)
  },
  setLaunchAtLogin: (enabled: boolean) => {
    ipcRenderer.send('set-launch-at-login', enabled)
  },
  setShowMenuBarWpm: (enabled: boolean) => {
    ipcRenderer.send('set-show-menu-bar-wpm', enabled)
  },
  setShowOverlay: (enabled: boolean) => {
    ipcRenderer.send('set-show-overlay', enabled)
  },
  setOpacity: (opacity: number) => {
    ipcRenderer.send('set-opacity', opacity)
  },
  setSmartColouring: (enabled: boolean) => {
    ipcRenderer.send('set-smart-colouring', enabled)
  },
  setGlobalShortcut: (shortcut: string) => {
    return ipcRenderer.invoke('set-global-shortcut', shortcut)
  },
  getGlobalShortcut: () => {
    return ipcRenderer.invoke('get-global-shortcut')
  },
  setLockOverlayToDesktop: (enabled: boolean) => {
    ipcRenderer.send('set-lock-overlay-to-desktop', enabled)
  },
  setWpmTextSize: (size: 'medium' | 'large') => {
    ipcRenderer.send('set-wpm-text-size', size)
  },
  resetAllSettings: () => {
    ipcRenderer.send('reset-all-settings')
  },
})
