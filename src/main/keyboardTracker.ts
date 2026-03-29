import { uIOhook } from 'uiohook-napi'

export interface Keystroke {
  key: string
  timestamp: number
}

export interface WPMStats {
  wpm: number
  charCount: number
  timeWindowMs: number
}

let keystrokes: Keystroke[] = []
let lastKeypressTime: number = 0
let wpmLogInterval: NodeJS.Timeout | null = null
let isHookRunning = false
const INACTIVITY_THRESHOLD = 2000

function handleInactivity() {
  const now = Date.now()
  if (lastKeypressTime > 0 && now - lastKeypressTime > INACTIVITY_THRESHOLD) {
    if (keystrokes.length > 0) {
      keystrokes = []
      lastKeypressTime = 0
    }
  }
}

function handleKeyDown(event: { keycode: number }) {
  lastKeypressTime = Date.now()
  
  keystrokes.push({
    key: `key${event.keycode}`,
    timestamp: lastKeypressTime
  })
}

function handleError(error: Error) {
  console.error('[TRACKER] Error:', error.message)
}

function calculateWPM(): WPMStats {
  const now = Date.now()
  
  if (keystrokes.length === 0 || lastKeypressTime === 0) {
    return { wpm: 0, charCount: 0, timeWindowMs: 0 }
  }
  
  if (now - lastKeypressTime > INACTIVITY_THRESHOLD) {
    return { wpm: 0, charCount: 0, timeWindowMs: 0 }
  }
  
  const oldest = Math.min(...keystrokes.map(k => k.timestamp))
  const newest = Math.max(...keystrokes.map(k => k.timestamp))
  const actualWindowMs = newest - oldest
  const minutes = actualWindowMs / 60000

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
    timeWindowMs: actualWindowMs
  }
}

function logWPM() {
  handleInactivity()
  const stats = calculateWPM()
  console.log(`[WPM] ${stats.wpm} | ${stats.charCount} chars`)
}

export function startTracking(): void {
  if (isHookRunning) {
    return
  }
  
  keystrokes = []
  lastKeypressTime = 0
  
  try {
    uIOhook.on('keydown', handleKeyDown)
    uIOhook.on('error', handleError)
    
    uIOhook.start()
    
    isHookRunning = true
    
    wpmLogInterval = setInterval(() => {
      logWPM()
    }, 1000)
    
  } catch (error) {
    console.error('[TRACKER] Failed to start:', error)
  }
}

export function stopTracking(): void {
  if (!isHookRunning) {
    return
  }
  
  if (wpmLogInterval) {
    clearInterval(wpmLogInterval)
    wpmLogInterval = null
  }
  
  try {
    uIOhook.off('keydown', handleKeyDown)
    uIOhook.off('error', handleError)
    uIOhook.stop()
  } catch (error) {
    console.error('[TRACKER] Error stopping:', error)
  }
  
  keystrokes = []
  lastKeypressTime = 0
  isHookRunning = false
}

export function getKeystrokes(): Keystroke[] {
  return [...keystrokes]
}

export function getKeystrokeCount(): number {
  return keystrokes.length
}

export function getWPM(): WPMStats {
  handleInactivity()
  return calculateWPM()
}

export function initTracking(): void {
  startTracking()
}
