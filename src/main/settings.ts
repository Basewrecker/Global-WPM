import { app } from 'electron'
import * as fs from 'fs'
import * as path from 'path'

export interface Settings {
  general: {
    launchAtLogin: boolean
    showMenuBarWpm: boolean
    globalShortcut: string
  }
  display: {
    showOverlay: boolean
    opacity: number
  }
  appearance: {
    smartColouring: boolean
  }
  behaviour: {
    inactivityTimeout: number
    minKeystrokes: number
  }
  tracking: {
    trackAccuracy: boolean
    trackRawWpm: boolean
  }
  advanced: {
    debugMode: boolean
  }
}

const defaultSettings: Settings = {
  general: {
    launchAtLogin: false,
    showMenuBarWpm: false,
    globalShortcut: 'Alt+Shift+W',
  },
  display: {
    showOverlay: true,
    opacity: 0.9,
  },
  appearance: {
    smartColouring: true,
  },
  behaviour: {
    inactivityTimeout: 3500,
    minKeystrokes: 10,
  },
  tracking: {
    trackAccuracy: false,
    trackRawWpm: true,
  },
  advanced: {
    debugMode: false,
  },
}

let settingsPath: string

function getSettingsPath(): string {
  if (!settingsPath) {
    settingsPath = path.join(app.getPath('userData'), 'settings.json')
  }
  return settingsPath
}

function deepMerge<T extends Record<string, unknown>>(target: T, source: Partial<T>): T {
  const result = { ...target }
  for (const key in source) {
    if (source[key] !== undefined) {
      if (
        typeof source[key] === 'object' &&
        source[key] !== null &&
        !Array.isArray(source[key]) &&
        typeof target[key] === 'object' &&
        target[key] !== null &&
        !Array.isArray(target[key])
      ) {
        result[key] = deepMerge(
          target[key] as Record<string, unknown>,
          source[key] as Record<string, unknown>
        ) as T[Extract<keyof T, string>]
      } else {
        result[key] = source[key] as T[Extract<keyof T, string>]
      }
    }
  }
  return result
}

function loadSettings(): Settings {
  try {
    const filePath = getSettingsPath()
    if (!fs.existsSync(filePath)) {
      return structuredClone(defaultSettings)
    }
    const data = fs.readFileSync(filePath, 'utf-8')
    const parsed = JSON.parse(data)
    return validateSettings(deepMerge(structuredClone(defaultSettings), parsed))
  } catch (error) {
    console.error('Failed to load settings:', error)
    return structuredClone(defaultSettings)
  }
}

function saveSettings(s: Settings): void {
  try {
    const filePath = getSettingsPath()
    fs.writeFileSync(filePath, JSON.stringify(s, null, 2))
  } catch (error) {
    console.error('Failed to save settings:', error)
  }
}

function validateSettings(s: Settings): Settings {
  const validated = structuredClone(defaultSettings)

  validated.general.launchAtLogin = typeof s.general?.launchAtLogin === 'boolean'
    ? s.general.launchAtLogin
    : defaultSettings.general.launchAtLogin

  validated.general.showMenuBarWpm = typeof s.general?.showMenuBarWpm === 'boolean'
    ? s.general.showMenuBarWpm
    : defaultSettings.general.showMenuBarWpm

  validated.general.globalShortcut = typeof s.general?.globalShortcut === 'string' && s.general.globalShortcut.length > 0
    ? s.general.globalShortcut
    : defaultSettings.general.globalShortcut

  validated.display.showOverlay = typeof s.display?.showOverlay === 'boolean'
    ? s.display.showOverlay
    : defaultSettings.display.showOverlay

  const opacity = s.display?.opacity
  validated.display.opacity = typeof opacity === 'number'
    ? Math.min(1, Math.max(0.3, opacity))
    : defaultSettings.display.opacity

  validated.appearance.smartColouring = typeof s.appearance?.smartColouring === 'boolean'
    ? s.appearance.smartColouring
    : defaultSettings.appearance.smartColouring

  const timeout = s.behaviour?.inactivityTimeout
  validated.behaviour.inactivityTimeout = typeof timeout === 'number'
    ? Math.min(10000, Math.max(2000, timeout))
    : defaultSettings.behaviour.inactivityTimeout

  const minKeys = s.behaviour?.minKeystrokes
  validated.behaviour.minKeystrokes = typeof minKeys === 'number'
    ? Math.max(1, Math.round(minKeys))
    : defaultSettings.behaviour.minKeystrokes

  validated.tracking.trackAccuracy = typeof s.tracking?.trackAccuracy === 'boolean'
    ? s.tracking.trackAccuracy
    : defaultSettings.tracking.trackAccuracy

  validated.tracking.trackRawWpm = typeof s.tracking?.trackRawWpm === 'boolean'
    ? s.tracking.trackRawWpm
    : defaultSettings.tracking.trackRawWpm

  validated.advanced.debugMode = typeof s.advanced?.debugMode === 'boolean'
    ? s.advanced.debugMode
    : defaultSettings.advanced.debugMode

  return validated
}

let settings: Settings = validateSettings(loadSettings())

export function getSettings(): Settings {
  return settings
}

export function updateSettings(partialSettings: Partial<Settings>): void {
  const merged = deepMerge(settings, partialSettings)
  settings = validateSettings(merged)
  saveSettings(settings)
}
