import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron'

export interface WPMStats {
  wpm: number
  charCount: number
  timeWindowMs: number
  lastKeyTime: number
  smartColouring: boolean
  wpmTextSize: 'medium' | 'large'
  colorRanges: {
    low: string
    mid: string
    high: string
    ultra: string
  }
  opacity: number
  blur: boolean
}

export interface ColorRanges {
  low: string
  mid: string
  high: string
  ultra: string
}

export interface ElectronAPI {
  subscribeToWPM: (callback: (stats: WPMStats) => void) => () => void
  setLaunchAtLogin: (enabled: boolean) => void
  setShowMenuBarWpm: (enabled: boolean) => void
  setShowOverlay: (enabled: boolean) => void
  setOpacity: (opacity: number) => void
  setBlur: (enabled: boolean) => void
  setSmartColouring: (enabled: boolean) => void
  setGlobalShortcut: (shortcut: string) => Promise<boolean>
  getGlobalShortcut: () => Promise<string>
  setLockOverlayToDesktop: (enabled: boolean) => void
  setWpmTextSize: (size: 'medium' | 'large') => void
  setColorRanges: (colorRanges: ColorRanges) => void
  getColorRanges: () => Promise<ColorRanges>
  setInactivityTimeout: (value: number) => void
  setMinKeystrokes: (value: number) => void
  setTrackingEnabled: (enabled: boolean) => void
  resetAllSettings: () => void
  getSessionStats: () => Promise<{ peakWpm: number; accuracy: number | null; totalKeystrokes: number; backspaces: number; avgWpm: number; timeTypedMs: number }>
  getLifetimeStats: () => Promise<{ peakWpm: number; accuracy: number | null; avgWpm: number; sessions: number; timeTypedMs: number }>
  resetSession: () => void
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
    return ipcRenderer.invoke('set-opacity', opacity)
  },
  setBlur: (enabled: boolean) => {
    return ipcRenderer.invoke('set-blur', enabled)
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
  setColorRanges: (colorRanges: ColorRanges) => {
    ipcRenderer.send('set-color-ranges', colorRanges)
  },
  getColorRanges: (): Promise<ColorRanges> => {
    return ipcRenderer.invoke('get-color-ranges')
  },
  setInactivityTimeout: (value: number) => {
    ipcRenderer.send('set-inactivity-timeout', value)
  },
  setMinKeystrokes: (value: number) => {
    ipcRenderer.send('set-min-keystrokes', value)
  },
  setTrackingEnabled: (enabled: boolean) => {
    ipcRenderer.send('set-tracking-enabled', enabled)
  },
  resetAllSettings: () => {
    ipcRenderer.send('reset-all-settings')
  },
  getSessionStats: () => {
    return ipcRenderer.invoke('get-session-stats')
  },
  getLifetimeStats: () => {
    return ipcRenderer.invoke('get-lifetime-stats')
  },
  resetSession: () => {
    ipcRenderer.send('reset-session')
  },
})
