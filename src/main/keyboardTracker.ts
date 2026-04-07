import { uIOhook } from 'uiohook-napi'
import { getSettings, updateSettings, Settings } from './settings'

export interface Keystroke {
  key: string
  timestamp: number
}

export interface WPMStats {
  wpm: number
  charCount: number
  timeWindowMs: number
  lastKeyTime: number
}

let keystrokes: Keystroke[] = []
let sessionStartTime: number = 0
let lastKeypressTime: number = 0
let isHookRunning = false

const ROLLING_WINDOW_MS = 10000
const MIN_TIME_SEC = 1.5

const stats = {
  lifetime: {
    highestWpm: 0,
    highestRawWpm: 0,
    highestAccuracy: 0,
    totalWpm: 0,
    totalRawWpm: 0,
    totalAccuracy: 0,
    totalSessions: 0,
  },
  session: {
    highestWpm: 0,
    highestRawWpm: 0,
    highestAccuracy: 0,
    keystrokes: 0,
    startTime: Date.now(),
  },
}

function isTypingKey(key: string): boolean {
  if (!key) return false

  const k = key.toLowerCase()

  if (k.length === 1) return true

  if (
    k.includes('arrow') ||
    k === 'backspace' ||
    k === 'enter' ||
    k === ' '
  ) {
    return true
  }

  if (
    k.includes('volume') ||
    k.includes('brightness') ||
    k.includes('media') ||
    k.startsWith('f') ||
    k === 'shift' ||
    k === 'control' ||
    k === 'alt' ||
    k === 'meta' ||
    k === 'capslock' ||
    k === 'escape' ||
    k === 'tab'
  ) {
    return false
  }

  return true
}

function handleKeyDown(event: { keycode: number; key?: string }) {
  const key = event.key || `key${event.keycode}`
  
  if (!isTypingKey(key)) return
  
  stats.session.keystrokes++
  
  const now = Date.now()
  lastKeypressTime = now
  
  if (sessionStartTime === 0) {
    sessionStartTime = now
  }
  
  keystrokes.push({
    key,
    timestamp: now
  })
}

function handleError(error: Error) {
  console.error('[TRACKER] Error:', error.message)
}

function calculateWPMInternal(strokes: Keystroke[]): number {
  if (strokes.length === 0) return 0
  
  const oldest = Math.min(...strokes.map(k => k.timestamp))
  const newest = Math.max(...strokes.map(k => k.timestamp))
  const actualWindowMs = newest - oldest
  const actualSeconds = actualWindowMs / 1000
  
  const settings = getSettings()
  const minChars = settings.behaviour?.minKeystrokes ?? 8
  
  if (strokes.length < minChars || actualSeconds < MIN_TIME_SEC) {
    return 0
  }
  
  const minutes = actualSeconds / 60
  const words = strokes.length / 5
  return Math.round(words / minutes)
}

function calculateWPM(): WPMStats {
  const now = Date.now()
  const settings = getSettings()
  const inactivityTimeout = settings.behaviour?.inactivityTimeout ?? 5000

  if (now - lastKeypressTime > inactivityTimeout) {
    keystrokes = []
    sessionStartTime = 0
    return { wpm: 0, charCount: 0, timeWindowMs: 0, lastKeyTime: 0 }
  }

  if (keystrokes.length === 0) {
    sessionStartTime = 0
    return { wpm: 0, charCount: 0, timeWindowMs: 0, lastKeyTime: 0 }
  }
  
  const windowStart = now - ROLLING_WINDOW_MS
  const recentKeystrokes = keystrokes.filter(k => k.timestamp > windowStart)
  
  if (recentKeystrokes.length === 0) {
    sessionStartTime = 0
    return { wpm: 0, charCount: 0, timeWindowMs: 0, lastKeyTime: 0 }
  }
  
  const oldest = Math.min(...recentKeystrokes.map(k => k.timestamp))
  const newest = Math.max(...recentKeystrokes.map(k => k.timestamp))
  const actualWindowMs = newest - oldest
  const actualSeconds = actualWindowMs / 1000
  
  const minChars = settings.behaviour?.minKeystrokes ?? 8
  
  if (recentKeystrokes.length < minChars || actualSeconds < MIN_TIME_SEC) {
    return { wpm: 0, charCount: recentKeystrokes.length, timeWindowMs: actualWindowMs, lastKeyTime: lastKeypressTime }
  }
  
  const minutes = actualSeconds / 60
  const words = recentKeystrokes.length / 5
  const wpm = Math.round(words / minutes)

  if (wpm > stats.session.highestWpm) {
    stats.session.highestWpm = wpm
  }

  return {
    wpm: Math.max(0, wpm),
    charCount: recentKeystrokes.length,
    timeWindowMs: actualWindowMs,
    lastKeyTime: lastKeypressTime
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

export { getSettings, updateSettings }
export type { Settings }
