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

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
