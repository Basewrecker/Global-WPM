export interface WPMStats {
  wpm: number
  charCount: number
  timeWindowMs: number
}

export interface ElectronAPI {
  subscribeToWPM: (callback: (stats: WPMStats) => void) => () => void
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
