import { Keystroke } from './keyboardTracker'

export interface WPMStats {
  wpm: number
  charCount: number
  timeWindowMs: number
}

export interface WPMCalculator {
  update: (keystrokes: Keystroke[]) => void
  getStats: () => WPMStats
  reset: () => void
}

export function createWPMCalculator(windowMs: number = 60000, updateIntervalMs: number = 500): WPMCalculator {
  let currentKeystrokes: Keystroke[] = []
  let intervalId: NodeJS.Timeout | null = null
  let onUpdate: ((stats: WPMStats) => void) | null = null

  function getRecentKeystrokes(): Keystroke[] {
    const cutoff = Date.now() - windowMs
    return currentKeystrokes.filter(k => k.timestamp > cutoff)
  }

  function calculateWPM(keystrokes: Keystroke[]): WPMStats {
    if (keystrokes.length === 0) {
      return { wpm: 0, charCount: 0, timeWindowMs: windowMs }
    }

    const now = Date.now()
    const oldest = Math.min(...keystrokes.map(k => k.timestamp))
    const newest = Math.max(...keystrokes.map(k => k.timestamp))
    
    const actualWindow = Math.min(newest - oldest, windowMs)
    const minutes = actualWindow / 60000
    
    const chars = keystrokes.length
    const words = chars / 5
    
    let wpm: number
    if (minutes === 0) {
      wpm = 0
    } else {
      wpm = Math.round(words / minutes)
    }

    return {
      wpm: Math.max(0, wpm),
      charCount: chars,
      timeWindowMs: actualWindow
    }
  }

  function update(keystrokes: Keystroke[]): void {
    currentKeystrokes = keystrokes
    const stats = getStats()
    if (onUpdate) {
      onUpdate(stats)
    }
  }

  function getStats(): WPMStats {
    const recent = getRecentKeystrokes()
    return calculateWPM(recent)
  }

  function reset(): void {
    currentKeystrokes = []
  }

  function start(callback: (stats: WPMStats) => void): void {
    if (intervalId) return
    onUpdate = callback
    intervalId = setInterval(() => {
      const stats = getStats()
      if (onUpdate) {
        onUpdate(stats)
      }
    }, updateIntervalMs)
  }

  function stop(): void {
    if (intervalId) {
      clearInterval(intervalId)
      intervalId = null
    }
    onUpdate = null
  }

  return {
    update,
    getStats,
    reset
  }
}
