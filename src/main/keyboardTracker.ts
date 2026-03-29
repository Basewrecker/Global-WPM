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
let sessionStartTime: number = 0
let lastKeypressTime: number = 0
let isHookRunning = false

const ROLLING_WINDOW_MS = 10000
const INACTIVITY_THRESHOLD = 2000
const MIN_CHARS = 8
const MIN_TIME_SEC = 1.5

function handleKeyDown(event: { keycode: number }) {
  const now = Date.now()
  lastKeypressTime = now
  
  if (sessionStartTime === 0) {
    sessionStartTime = now
  }
  
  keystrokes.push({
    key: `key${event.keycode}`,
    timestamp: now
  })
}

function handleError(error: Error) {
  console.error('[TRACKER] Error:', error.message)
}

function calculateWPM(): WPMStats {
  const now = Date.now()
  
  if (keystrokes.length === 0) {
    sessionStartTime = 0
    return { wpm: 0, charCount: 0, timeWindowMs: 0 }
  }
  
  if (now - lastKeypressTime > INACTIVITY_THRESHOLD) {
    keystrokes = []
    sessionStartTime = 0
    return { wpm: 0, charCount: 0, timeWindowMs: 0 }
  }
  
  const windowStart = now - ROLLING_WINDOW_MS
  const recentKeystrokes = keystrokes.filter(k => k.timestamp > windowStart)
  
  if (recentKeystrokes.length === 0) {
    sessionStartTime = 0
    return { wpm: 0, charCount: 0, timeWindowMs: 0 }
  }
  
  const oldest = Math.min(...recentKeystrokes.map(k => k.timestamp))
  const newest = Math.max(...recentKeystrokes.map(k => k.timestamp))
  const actualWindowMs = newest - oldest
  const actualSeconds = actualWindowMs / 1000
  
  if (recentKeystrokes.length < MIN_CHARS || actualSeconds < MIN_TIME_SEC) {
    return { wpm: 0, charCount: recentKeystrokes.length, timeWindowMs: actualWindowMs }
  }
  
  const minutes = actualSeconds / 60
  const words = recentKeystrokes.length / 5
  const wpm = Math.round(words / minutes)

  return {
    wpm: Math.max(0, wpm),
    charCount: recentKeystrokes.length,
    timeWindowMs: actualWindowMs
  }
}

export function startTracking(): void {
  if (isHookRunning) {
    return
  }
  
  keystrokes = []
  sessionStartTime = 0
  lastKeypressTime = 0
  
  try {
    uIOhook.on('keydown', handleKeyDown)
    uIOhook.on('error', handleError)
    
    uIOhook.start()
    
    isHookRunning = true
  } catch (error) {
    console.error('[TRACKER] Failed to start:', error)
  }
}

export function stopTracking(): void {
  if (!isHookRunning) {
    return
  }
  
  try {
    uIOhook.off('keydown', handleKeyDown)
    uIOhook.off('error', handleError)
    uIOhook.stop()
  } catch (error) {
    console.error('[TRACKER] Error stopping:', error)
  }
  
  keystrokes = []
  sessionStartTime = 0
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
  return calculateWPM()
}

export function initTracking(): void {
  startTracking()
}
