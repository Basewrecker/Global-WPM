import { uIOhook, UiohookKey } from 'uiohook-napi'
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

// Keycodes that count toward WPM: letters, digits, space, punctuation.
// Shift+digit (! @ # $ % ^ & * ( )) shares the same keycode as the digit key.
const TYPING_KEYCODES = new Set<number>([
  // Letters a–z
  UiohookKey.A, UiohookKey.B, UiohookKey.C, UiohookKey.D, UiohookKey.E,
  UiohookKey.F, UiohookKey.G, UiohookKey.H, UiohookKey.I, UiohookKey.J,
  UiohookKey.K, UiohookKey.L, UiohookKey.M, UiohookKey.N, UiohookKey.O,
  UiohookKey.P, UiohookKey.Q, UiohookKey.R, UiohookKey.S, UiohookKey.T,
  UiohookKey.U, UiohookKey.V, UiohookKey.W, UiohookKey.X, UiohookKey.Y,
  UiohookKey.Z,
  // Digits 0–9
  UiohookKey[0], UiohookKey[1], UiohookKey[2], UiohookKey[3], UiohookKey[4],
  UiohookKey[5], UiohookKey[6], UiohookKey[7], UiohookKey[8], UiohookKey[9],
  // Space
  UiohookKey.Space,
  // Punctuation / special character keys (covers both unshifted and shifted)
  UiohookKey.Backquote,    // ` ~
  UiohookKey.Minus,        // - _
  UiohookKey.Equal,        // = +
  UiohookKey.BracketLeft,  // [ {
  UiohookKey.BracketRight, // ] }
  UiohookKey.Backslash,    // \ |
  UiohookKey.Semicolon,    // ; :
  UiohookKey.Quote,        // ' "
  UiohookKey.Comma,        // , <
  UiohookKey.Period,       // . >
  UiohookKey.Slash,        // / ?
])

let keystrokes: Keystroke[] = []
let sessionStartTime: number = 0
let lastKeypressTime: number = 0
let isHookRunning = false

let sessionBackspaces: number = 0
let totalActiveMs: number = 0
let sessionWallStart: number = 0
let wpmSamples: number[] = []

// Cumulative per-key and per-hour counters for the current session
let sessionKeyFrequency: Record<string, number> = {}
let sessionHourly: number[] = new Array(24).fill(0)

// Snapshot of what was last committed to lifetime, for delta calculations
let snapshotKeystrokes: number = 0
let snapshotBackspaces: number = 0
let snapshotActiveMs: number = 0
let snapshotKeyFrequency: Record<string, number> = {}
let snapshotHourly: number[] = new Array(24).fill(0)

// Maps a typing keycode to its normalized heatmap key name.
// Mirrors TYPING_KEYCODES exactly — every key that passes that gate has a name here.
const KEYCODE_TO_NAME: Record<number, string> = {
  [UiohookKey.A]: 'a', [UiohookKey.B]: 'b', [UiohookKey.C]: 'c', [UiohookKey.D]: 'd', [UiohookKey.E]: 'e',
  [UiohookKey.F]: 'f', [UiohookKey.G]: 'g', [UiohookKey.H]: 'h', [UiohookKey.I]: 'i', [UiohookKey.J]: 'j',
  [UiohookKey.K]: 'k', [UiohookKey.L]: 'l', [UiohookKey.M]: 'm', [UiohookKey.N]: 'n', [UiohookKey.O]: 'o',
  [UiohookKey.P]: 'p', [UiohookKey.Q]: 'q', [UiohookKey.R]: 'r', [UiohookKey.S]: 's', [UiohookKey.T]: 't',
  [UiohookKey.U]: 'u', [UiohookKey.V]: 'v', [UiohookKey.W]: 'w', [UiohookKey.X]: 'x', [UiohookKey.Y]: 'y',
  [UiohookKey.Z]: 'z',
  [UiohookKey[0]]: '0', [UiohookKey[1]]: '1', [UiohookKey[2]]: '2', [UiohookKey[3]]: '3', [UiohookKey[4]]: '4',
  [UiohookKey[5]]: '5', [UiohookKey[6]]: '6', [UiohookKey[7]]: '7', [UiohookKey[8]]: '8', [UiohookKey[9]]: '9',
  [UiohookKey.Space]: 'space',
  [UiohookKey.Backquote]: 'backquote',
  [UiohookKey.Minus]: 'minus',
  [UiohookKey.Equal]: 'equal',
  [UiohookKey.BracketLeft]: 'bracketleft',
  [UiohookKey.BracketRight]: 'bracketright',
  [UiohookKey.Backslash]: 'backslash',
  [UiohookKey.Semicolon]: 'semicolon',
  [UiohookKey.Quote]: 'quote',
  [UiohookKey.Comma]: 'comma',
  [UiohookKey.Period]: 'period',
  [UiohookKey.Slash]: 'slash',
}

const ROLLING_WINDOW_MS = 10000
const MIN_TIME_SEC = 1.5

export const MIN_SESSION_KEYS = 20
export const MIN_SESSION_MS = 8000

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

function handleKeyDown(event: { keycode: number; key?: string }) {
  const now = Date.now()

  if (event.keycode === UiohookKey.Backspace) {
    sessionBackspaces++
    return
  }

  if (!TYPING_KEYCODES.has(event.keycode)) return

  const settings = getSettings()
  const inactivityMs = settings.behaviour?.inactivityTimeout ?? 3500
  if (lastKeypressTime > 0 && now - lastKeypressTime < inactivityMs) {
    totalActiveMs += now - lastKeypressTime
  }

  stats.session.keystrokes++
  lastKeypressTime = now

  if (sessionWallStart === 0) sessionWallStart = now
  if (sessionStartTime === 0) sessionStartTime = now

  const keyName = KEYCODE_TO_NAME[event.keycode]
  if (keyName) {
    sessionKeyFrequency[keyName] = (sessionKeyFrequency[keyName] || 0) + 1
  }
  sessionHourly[new Date().getHours()]++

  keystrokes.push({
    key: `key${event.keycode}`,
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
  wpmSamples.push(wpm)

  return {
    wpm: Math.max(0, wpm),
    charCount: recentKeystrokes.length,
    timeWindowMs: actualWindowMs,
    lastKeyTime: lastKeypressTime
  }
}

export interface SessionStats {
  peakWpm: number
  accuracy: number | null
  totalKeystrokes: number
  backspaces: number
  avgWpm: number
  timeTypedMs: number
}

export interface SessionSummary {
  peakWpm: number
  totalKeystrokes: number
  totalBackspaces: number
  totalActiveMs: number
  keyFrequencyDelta: Record<string, number>
  hourlyDelta: number[]
}

export function getSessionStats(): SessionStats {
  const total = stats.session.keystrokes
  const backspaces = sessionBackspaces
  const accuracy = total >= 10
    ? Math.round((total / (total + backspaces)) * 100)
    : null

  const peak = stats.session.highestWpm
  const avgWpm = wpmSamples.length > 0
    ? Math.min(Math.round(wpmSamples.reduce((a, b) => a + b, 0) / wpmSamples.length), peak)
    : 0

  return {
    peakWpm: peak,
    accuracy,
    totalKeystrokes: total,
    backspaces,
    avgWpm,
    timeTypedMs: totalActiveMs,
  }
}

export function finalizeSession(): SessionSummary {
  const keyFrequencyDelta: Record<string, number> = {}
  for (const key in sessionKeyFrequency) {
    const delta = sessionKeyFrequency[key] - (snapshotKeyFrequency[key] || 0)
    if (delta > 0) keyFrequencyDelta[key] = delta
  }
  const hourlyDelta = sessionHourly.map((count, hour) => count - (snapshotHourly[hour] || 0))

  const summary: SessionSummary = {
    peakWpm: stats.session.highestWpm,
    totalKeystrokes: stats.session.keystrokes - snapshotKeystrokes,
    totalBackspaces: sessionBackspaces - snapshotBackspaces,
    totalActiveMs: totalActiveMs - snapshotActiveMs,
    keyFrequencyDelta,
    hourlyDelta,
  }
  snapshotKeystrokes = stats.session.keystrokes
  snapshotBackspaces = sessionBackspaces
  snapshotActiveMs = totalActiveMs
  snapshotKeyFrequency = { ...sessionKeyFrequency }
  snapshotHourly = [...sessionHourly]
  return summary
}

export function resetSession(): void {
  stats.session.highestWpm = 0
  stats.session.highestRawWpm = 0
  stats.session.highestAccuracy = 0
  stats.session.keystrokes = 0
  stats.session.startTime = Date.now()
  sessionBackspaces = 0
  sessionWallStart = 0
  totalActiveMs = 0
  snapshotKeystrokes = 0
  snapshotBackspaces = 0
  snapshotActiveMs = 0
  sessionKeyFrequency = {}
  sessionHourly = new Array(24).fill(0)
  snapshotKeyFrequency = {}
  snapshotHourly = new Array(24).fill(0)
  wpmSamples = []
  keystrokes = []
  sessionStartTime = 0
  lastKeypressTime = 0
}

export function startTracking(): void {
  if (isHookRunning) {
    return
  }

  keystrokes = []
  sessionStartTime = 0
  lastKeypressTime = 0
  sessionBackspaces = 0
  sessionWallStart = 0
  totalActiveMs = 0
  snapshotKeystrokes = 0
  snapshotBackspaces = 0
  snapshotActiveMs = 0
  sessionKeyFrequency = {}
  sessionHourly = new Array(24).fill(0)
  snapshotKeyFrequency = {}
  snapshotHourly = new Array(24).fill(0)
  wpmSamples = []

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
  wpmSamples = []
  isHookRunning = false
}

export function getKeystrokes(): Keystroke[] {
  return [...keystrokes]
}

export function getKeystrokeCount(): number {
  return keystrokes.length
}

export function getSessionKeyFrequency(): Record<string, number> {
  return { ...sessionKeyFrequency }
}

export function getSessionHourly(): number[] {
  return [...sessionHourly]
}

export function getWPM(): WPMStats {
  return calculateWPM()
}

export function initTracking(): void {
  startTracking()
}

export { getSettings, updateSettings }
export type { Settings }
