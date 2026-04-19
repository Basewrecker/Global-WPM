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
  getColorRanges: () => Promise<{ low: string; mid: string; high: string; ultra: string } | null>
  setColorRanges: (ranges: { low: string; mid: string; high: string; ultra: string }) => void
  setInactivityTimeout: (value: number) => void
  setMinKeystrokes: (value: number) => void
  resetAllSettings: () => void
  getSessionStats: () => Promise<{ peakWpm: number; accuracy: number | null; totalKeystrokes: number; backspaces: number; avgWpm: number; timeTypedMs: number }>
  getLifetimeStats: () => Promise<{ peakWpm: number; accuracy: number | null; avgWpm: number; sessions: number; timeTypedMs: number }>
  resetSession: () => void
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
