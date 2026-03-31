export interface WPMStats {
  wpm: number
  charCount: number
  timeWindowMs: number
  smartColouring: boolean
}

export interface ElectronAPI {
  subscribeToWPM: (callback: (stats: WPMStats) => void) => () => void
  setLaunchAtLogin: (enabled: boolean) => void
  setShowMenuBarWpm: (enabled: boolean) => void
  setShowOverlay: (enabled: boolean) => void
  setOpacity: (opacity: number) => void
  setSmartColouring: (enabled: boolean) => void
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
