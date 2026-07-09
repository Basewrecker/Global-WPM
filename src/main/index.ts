import { app, BrowserWindow, screen, Tray, Menu, nativeImage, ipcMain, globalShortcut } from 'electron'
import { join } from 'path'
import { initTracking, startTracking, stopTracking, getWPM, getSessionStats as getTrackerSessionStats, resetSession, finalizeSession, getSessionKeyFrequency, getSessionHourly, MIN_SESSION_KEYS, MIN_SESSION_MS } from './keyboardTracker'
import { getSettings, updateSettings } from './settings'
import Store from 'electron-store'

process.env.DIST_ELECTRON = join(__dirname, '..')
process.env.DIST = join(process.env.DIST_ELECTRON, '../dist')
process.env.VITE_PUBLIC = process.env.VITE_DEV_SERVER_URL
  ? join(process.env.DIST_ELECTRON, '../public')
  : join(process.env.DIST, '../public')

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null
let settingsWindow: BrowserWindow | null = null
let statsWindow: BrowserWindow | null = null
let wpmUpdateInterval: NodeJS.Timeout | null = null
let fadeInterval: NodeJS.Timeout | null = null
let moveTimeout: NodeJS.Timeout | null = null
let registeredShortcut: string | null = null
let hasSavedPosition = false
let isQuitting = false
let menuBarTitleCleared = true
let currentDisplayId: number | null = null

const SETTINGS_WIDTH = 780
const SETTINGS_HEIGHT = 560
const STATS_WIDTH = 480
const STATS_HEIGHT = 460

const WINDOW_WIDTH = 158
const WINDOW_HEIGHT = 48
const WINDOW_WIDTH_LARGE = 178
const WINDOW_HEIGHT_LARGE = 56
const preload = join(__dirname, '../preload/index.js')

const store = new Store({
  name: 'window-position',
  defaults: {
    overlayBounds: null as { x: number; y: number } | null
  }
})

interface LifetimeData {
  peakWpm: number
  totalKeystrokes: number
  totalBackspaces: number
  totalActiveMs: number
  sessions: number
  keyFrequency: Record<string, number>
  hourly: number[]
}

const lifetimeStore = new Store({
  name: 'lifetime-stats',
  defaults: {
    data: {
      peakWpm: 0,
      totalKeystrokes: 0,
      totalBackspaces: 0,
      totalActiveMs: 0,
      sessions: 0,
      keyFrequency: {},
      hourly: new Array(24).fill(0),
    } as LifetimeData
  }
})

// Guards against data persisted before keyFrequency/hourly existed (defaults only
// apply on a brand-new store, not to fields missing from an already-stored object).
function normalizeHourly(hourly: unknown): number[] {
  return Array.isArray(hourly) && hourly.length === 24 ? hourly : new Array(24).fill(0)
}

let sessionFinalizedThisLaunch = false

function saveSessionToLifetime() {
  const sessionStats = getTrackerSessionStats()
  const summary = finalizeSession()
  if (summary.totalKeystrokes === 0 && summary.totalActiveMs === 0) {
    return
  }

  const qualifies = sessionStats.totalKeystrokes >= MIN_SESSION_KEYS
    && sessionStats.timeTypedMs >= MIN_SESSION_MS
  const shouldCountSession = qualifies && !sessionFinalizedThisLaunch
  if (shouldCountSession) sessionFinalizedThisLaunch = true

  const prev = lifetimeStore.get('data') as LifetimeData

  const keyFrequency = { ...(prev.keyFrequency || {}) }
  for (const key in summary.keyFrequencyDelta) {
    keyFrequency[key] = (keyFrequency[key] || 0) + summary.keyFrequencyDelta[key]
  }
  const hourly = normalizeHourly(prev.hourly).map((count, hour) => count + (summary.hourlyDelta[hour] || 0))

  const next: LifetimeData = {
    peakWpm: Math.max(prev.peakWpm, summary.peakWpm),
    totalKeystrokes: prev.totalKeystrokes + summary.totalKeystrokes,
    totalBackspaces: prev.totalBackspaces + summary.totalBackspaces,
    totalActiveMs: prev.totalActiveMs + summary.totalActiveMs,
    sessions: prev.sessions + (shouldCountSession ? 1 : 0),
    keyFrequency,
    hourly,
  }
  lifetimeStore.set('data', next)
}

function safeSend(win: BrowserWindow | null, channel: string, data?: unknown) {
  try {
    if (!win || win.isDestroyed()) return
    const wc = win.webContents
    if (!wc || wc.isDestroyed()) return
    wc.send(channel, data)
  } catch {
    // swallow — window was destroyed between check and send
  }
}

let opacityTimeout: NodeJS.Timeout | null = null

function getMenuBarWpm(wpm: number): string {
  return `${wpm}`
}

function startWPMBroadcast() {
  if (wpmUpdateInterval) return

  wpmUpdateInterval = setInterval(() => {
    const settings = getSettings()
    const stats = getWPM()

    if (mainWindow && !mainWindow.isDestroyed() && mainWindow.isVisible()) {
      safeSend(mainWindow, 'wpm:update', {
        ...stats,
        smartColouring: settings.appearance.smartColouring,
        wpmTextSize: settings.appearance.wpmTextSize,
        colorRanges: settings.appearance.colorRanges,
        opacity: settings.display.opacity,
        blur: settings.display.blur
      })
    }

    if (tray) {
      if (settings.general.showMenuBarWpm) {
        tray.setTitle(getMenuBarWpm(stats.wpm))
        menuBarTitleCleared = false
      } else if (!menuBarTitleCleared) {
        tray.setTitle('')
        menuBarTitleCleared = true
      }
    }
  }, 100)
}

function stopWPMBroadcast() {
  if (wpmUpdateInterval) {
    clearInterval(wpmUpdateInterval)
    wpmUpdateInterval = null
  }
}

function setTopRightPosition() {
  if (!mainWindow || mainWindow.isDestroyed()) return

  const { width } = screen.getPrimaryDisplay().workAreaSize
  const x = Math.round(width - WINDOW_WIDTH - 10)
  const y = 30

  mainWindow.setPosition(x, y)
}

function isPointOnAnyDisplay(x: number, y: number): boolean {
  const nearest = screen.getDisplayNearestPoint({ x, y })
  return x >= nearest.bounds.x && x < nearest.bounds.x + nearest.bounds.width
    && y >= nearest.bounds.y && y < nearest.bounds.y + nearest.bounds.height
}

function reassertOverlayCompositing() {
  if (!mainWindow || mainWindow.isDestroyed()) return
  mainWindow.setBackgroundColor('#00000000')
  // Overlay blur is CSS backdrop-filter now (not native vibrancy) — this is a
  // safety clear only, never re-enables 'under-window' vibrancy for the overlay.
  mainWindow.setVibrancy(undefined)
}

function revalidateOverlayForDisplays() {
  if (!mainWindow || mainWindow.isDestroyed() || !mainWindow.isVisible()) return

  const bounds = mainWindow.getBounds()
  if (!isPointOnAnyDisplay(bounds.x, bounds.y)) {
    setTopRightPosition()
  }

  currentDisplayId = screen.getDisplayMatching(mainWindow.getBounds()).id
  reassertOverlayCompositing()
}

function createWindow() {
  const savedBounds = store.get('overlayBounds') as { x: number; y: number } | null
  hasSavedPosition = savedBounds !== null
    && typeof savedBounds.x === 'number'
    && typeof savedBounds.y === 'number'
    && isPointOnAnyDisplay(savedBounds.x, savedBounds.y)

  mainWindow = new BrowserWindow({
    width: WINDOW_WIDTH,
    height: WINDOW_HEIGHT,
    x: hasSavedPosition ? savedBounds.x : undefined,
    y: hasSavedPosition ? savedBounds.y : undefined,
    frame: false,
    transparent: true,
    resizable: false,
    movable: true,
    fullscreenable: false,
    hasShadow: false,
    minimizable: false,
    maximizable: false,
    closable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    show: true,
    webPreferences: {
      preload,
      nodeIntegration: false,
      contextIsolation: true,
    },
    backgroundColor: '#00000000',
    visualEffectState: 'active',
  })

  mainWindow.setMovable(true)
  mainWindow.setAlwaysOnTop(true, 'floating')
  mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  mainWindow.setBackgroundColor('#00000000')
  currentDisplayId = screen.getDisplayMatching(mainWindow.getBounds()).id

  mainWindow.on('ready-to-show', () => {
    if (!hasSavedPosition) {
      setTopRightPosition()
      setTimeout(setTopRightPosition, 50)
      setTimeout(setTopRightPosition, 150)
    }
  })

  mainWindow.on('resize', () => {
    if (!hasSavedPosition) {
      setTopRightPosition()
    }
  })

  mainWindow.on('move', () => {
    if (moveTimeout) clearTimeout(moveTimeout)
    moveTimeout = setTimeout(() => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        const [x, y] = mainWindow.getPosition()
        store.set('overlayBounds', { x, y })

        const display = screen.getDisplayMatching(mainWindow.getBounds())
        if (display.id !== currentDisplayId) {
          reassertOverlayCompositing()
          currentDisplayId = display.id
        }
      }
    }, 200)
  })

  mainWindow.on('close', (e) => {
    if (isQuitting) return
    e.preventDefault()
    hideWindowAnimated()
  })

  mainWindow.on('closed', () => {
    stopWPMBroadcast()
    if (fadeInterval) {
      clearInterval(fadeInterval)
      fadeInterval = null
    }
    if (opacityTimeout) {
      clearTimeout(opacityTimeout)
      opacityTimeout = null
    }
    if (moveTimeout) {
      clearTimeout(moveTimeout)
      moveTimeout = null
    }
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
  } else {
    mainWindow.loadFile(join(process.env.DIST, 'index.html'))
  }
  
  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow?.setBackgroundColor('#00000000')
    mainWindow?.show()
    startWPMBroadcast()
    if (!hasSavedPosition) {
      setTopRightPosition()
    }
  })
}

function showWindowAnimated() {
  if (!mainWindow || mainWindow.isDestroyed()) return

  if (fadeInterval) {
    clearInterval(fadeInterval)
    fadeInterval = null
  }

  mainWindow.setOpacity(0)
  mainWindow.show()

  let opacity = 0
  fadeInterval = setInterval(() => {
    opacity += 0.1
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.setOpacity(opacity)
    }

    if (opacity >= 1) {
      if (fadeInterval) {
        clearInterval(fadeInterval)
        fadeInterval = null
      }
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.setOpacity(1)
      }
    }
  }, 15)
}

function hideWindowAnimated() {
  if (!mainWindow || mainWindow.isDestroyed()) return

  if (fadeInterval) {
    clearInterval(fadeInterval)
    fadeInterval = null
  }

  let opacity = 1
  fadeInterval = setInterval(() => {
    opacity -= 0.1
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.setOpacity(opacity)
    }

    if (opacity <= 0) {
      if (fadeInterval) {
        clearInterval(fadeInterval)
        fadeInterval = null
      }
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.hide()
        mainWindow.setOpacity(1)
      }
    }
  }, 15)
}

function showWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    createWindow()
  } else {
    showWindowAnimated()
  }
}

function hideWindow() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    hideWindowAnimated()
  }
}

function setOverlayVisible(visible: boolean) {
  if (!mainWindow || mainWindow.isDestroyed()) return
  
  if (visible) {
    showWindowAnimated()
  } else {
    hideWindowAnimated()
  }
}

function setOverlayOpacity(opacity: number) {
  if (opacityTimeout) {
    clearTimeout(opacityTimeout)
    opacityTimeout = null
  }
  opacityTimeout = setTimeout(() => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.setOpacity(Math.min(1, Math.max(0.3, opacity)))
    }
  }, 16)
}

function toggleWindow() {
  if (mainWindow && !mainWindow.isDestroyed() && mainWindow.isVisible()) {
    hideWindow()
  } else {
    showWindow()
  }
}

function unregisterShortcut() {
  if (registeredShortcut) {
    try {
      globalShortcut.unregister(registeredShortcut)
    } catch {}
    registeredShortcut = null
  }
}

function registerShortcut(shortcut: string): boolean {
  try {
    if (registeredShortcut) {
      globalShortcut.unregister(registeredShortcut)
    }
    
    const success = globalShortcut.register(shortcut, () => {
      toggleWindow()
    })
    
    if (success) {
      registeredShortcut = shortcut
    }
    return success
  } catch {
    return false
  }
}

function createSettingsWindow() {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.focus()
    return
  }

  const { width, height } = screen.getPrimaryDisplay().workAreaSize

  settingsWindow = new BrowserWindow({
    width: SETTINGS_WIDTH,
    height: SETTINGS_HEIGHT,
    x: Math.round((width - SETTINGS_WIDTH) / 2),
    y: Math.round((height - SETTINGS_HEIGHT) / 2),
    frame: false,
    titleBarStyle: 'hiddenInset',
    resizable: false,
    minimizable: false,
    maximizable: false,
    show: true,
    vibrancy: 'sidebar',
    visualEffectState: 'active',
    backgroundMaterial: 'sidebar',
    webPreferences: {
      preload,
      nodeIntegration: false,
      contextIsolation: true,
    },
    backgroundColor: '#00000000',
  })

  const baseUrl = process.env.VITE_DEV_SERVER_URL || 'http://localhost:51737'
  const settingsUrl = baseUrl.endsWith('/') ? `${baseUrl}#/settings` : `${baseUrl}/#/settings`
  
  settingsWindow.loadURL(settingsUrl)

  settingsWindow.on('closed', () => {
    settingsWindow = null
  })
}

function createStatsWindow() {
  if (statsWindow && !statsWindow.isDestroyed()) {
    statsWindow.focus()
    return
  }

  const { width, height } = screen.getPrimaryDisplay().workAreaSize

  statsWindow = new BrowserWindow({
    width: STATS_WIDTH,
    height: STATS_HEIGHT,
    x: Math.round((width - STATS_WIDTH) / 2),
    y: Math.round((height - STATS_HEIGHT) / 2),
    frame: false,
    titleBarStyle: 'hiddenInset',
    resizable: false,
    minimizable: false,
    maximizable: false,
    show: true,
    vibrancy: 'sidebar',
    visualEffectState: 'active',
    backgroundMaterial: 'sidebar',
    webPreferences: {
      preload,
      nodeIntegration: false,
      contextIsolation: true,
    },
    backgroundColor: '#00000000',
  })

  const baseUrl = process.env.VITE_DEV_SERVER_URL || 'http://localhost:51737'
  const statsUrl = baseUrl.endsWith('/') ? `${baseUrl}#/stats` : `${baseUrl}/#/stats`

  statsWindow.loadURL(statsUrl)

  statsWindow.on('closed', () => {
    saveSessionToLifetime()
    statsWindow = null
  })
}

function getContextMenu() {
  const isVisible = mainWindow && mainWindow.isVisible()
  const shortcut = getSettings().general.globalShortcut

  return Menu.buildFromTemplate([
    {
      label: isVisible ? 'Hide' : 'Show',
      accelerator: shortcut,
      click: () => {
        if (!mainWindow) return

        if (mainWindow.isVisible()) {
          hideWindowAnimated()
        } else {
          showWindowAnimated()
        }
      }
    },
    { type: 'separator' },
    {
      label: 'Stats',
      click: () => { createStatsWindow() }
    },
    {
      label: 'Settings',
      click: () => {
        createSettingsWindow()
      }
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => app.quit()
    }
  ])
}

function createTray() {
  if (tray) {
    tray.destroy()
  }

  const iconPath = join(__dirname, '../../public/trayTemplate.png')
  let trayIcon = nativeImage.createFromPath(iconPath)

  trayIcon = trayIcon.resize({ width: 16, height: 16 })
  trayIcon.setTemplateImage(true)

  tray = new Tray(trayIcon)

  tray.on('click', () => {
    tray.popUpContextMenu(getContextMenu())
  })
}

app.whenReady().then(() => {
  app.dock.hide()
  
  const settings = getSettings()
  app.setLoginItemSettings({ openAtLogin: settings.general.launchAtLogin })
  
  registerShortcut(settings.general.globalShortcut)
  
  createWindow()
  
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.setOpacity(settings.display.opacity)
    mainWindow.setVisibleOnAllWorkspaces(!settings.general.lockOverlayToDesktop, { visibleOnFullScreen: !settings.general.lockOverlayToDesktop })
    if (!settings.display.showOverlay) {
      mainWindow.hide()
    }
  }
  
  createTray()
  initTracking()
  if (!settings.general.trackingEnabled) {
    stopTracking()
  }
  startWPMBroadcast()

  screen.on('display-metrics-changed', revalidateOverlayForDisplays)
  screen.on('display-removed', revalidateOverlayForDisplays)
})

ipcMain.on('set-tracking-enabled', (_, enabled: boolean) => {
  updateSettings({ general: { trackingEnabled: enabled } })
  if (enabled) {
    startTracking()
  } else {
    stopTracking()
  }
})

ipcMain.on('set-launch-at-login', (_, enabled: boolean) => {
  app.setLoginItemSettings({ openAtLogin: enabled })
  updateSettings({ general: { launchAtLogin: enabled } })
})

ipcMain.on('set-show-menu-bar-wpm', (_, enabled: boolean) => {
  updateSettings({ general: { showMenuBarWpm: enabled } })
  if (tray) {
    if (enabled) {
      const stats = getWPM()
      tray.setTitle(getMenuBarWpm(stats.wpm))
      menuBarTitleCleared = false
    } else {
      tray.setTitle('')
      menuBarTitleCleared = true
    }
  }
})

ipcMain.on('set-show-overlay', (_, enabled: boolean) => {
  updateSettings({ display: { showOverlay: enabled } })
  setOverlayVisible(enabled)
})

ipcMain.handle('set-opacity', (_, opacity: number) => {
  if (!mainWindow || mainWindow.isDestroyed()) return
  const normalizedOpacity = opacity / 100
  updateSettings({ display: { opacity: normalizedOpacity } })
  setOverlayOpacity(normalizedOpacity)
})

ipcMain.handle('set-blur', (_, enabled: boolean) => {
  if (!mainWindow || mainWindow.isDestroyed()) return
  updateSettings({ display: { blur: enabled } })
  if (!enabled) {
    mainWindow.setVibrancy(undefined)
  }
})

ipcMain.on('set-smart-colouring', (_, enabled: boolean) => {
  updateSettings({ appearance: { smartColouring: enabled } })
})

ipcMain.on('set-inactivity-timeout', (_, value: number) => {
  updateSettings({ behaviour: { inactivityTimeout: value } })
})

ipcMain.on('set-min-keystrokes', (_, value: number) => {
  updateSettings({ behaviour: { minKeystrokes: value } })
})

ipcMain.handle('set-global-shortcut', (_, shortcut: string) => {
  const success = registerShortcut(shortcut)
  if (success) {
    updateSettings({ general: { globalShortcut: shortcut } })
    if (tray) {
      tray.setContextMenu(getContextMenu())
    }
  }
  return success
})

ipcMain.handle('get-global-shortcut', () => {
  return getSettings().general.globalShortcut
})

ipcMain.handle('get-color-ranges', () => {
  return getSettings().appearance.colorRanges
})

ipcMain.handle('get-session-stats', () => {
  return getTrackerSessionStats()
})

ipcMain.handle('get-lifetime-stats', () => {
  const data = lifetimeStore.get('data') as LifetimeData
  const sessionStats = getTrackerSessionStats()

  const mergedKeystrokes = data.totalKeystrokes + sessionStats.totalKeystrokes
  const mergedBackspaces = data.totalBackspaces + sessionStats.backspaces
  const accuracy = mergedKeystrokes >= 10
    ? Math.round((mergedKeystrokes / (mergedKeystrokes + mergedBackspaces)) * 100)
    : null
  const avgWpm = data.totalActiveMs > 0 && data.totalKeystrokes > 0
    ? Math.round((data.totalKeystrokes / 5) / (data.totalActiveMs / 60000))
    : 0
  return {
    peakWpm: Math.max(data.peakWpm, sessionStats.peakWpm),
    accuracy,
    avgWpm,
    sessions: data.sessions,
    timeTypedMs: data.totalActiveMs,
  }
})

ipcMain.handle('get-heatmap-data', () => {
  const data = lifetimeStore.get('data') as LifetimeData
  const sessionKeyFrequency = getSessionKeyFrequency()
  const sessionHourly = getSessionHourly()

  const lifetimeKeyFrequency: Record<string, number> = { ...(data.keyFrequency || {}) }
  for (const key in sessionKeyFrequency) {
    lifetimeKeyFrequency[key] = (lifetimeKeyFrequency[key] || 0) + sessionKeyFrequency[key]
  }
  const lifetimeHourly = normalizeHourly(data.hourly).map((count, hour) => count + (sessionHourly[hour] || 0))

  return {
    lifetime: { keyFrequency: lifetimeKeyFrequency, hourly: lifetimeHourly },
    session: { keyFrequency: sessionKeyFrequency, hourly: sessionHourly },
  }
})

ipcMain.on('reset-session', () => {
  resetSession()
  sessionFinalizedThisLaunch = false
})

ipcMain.on('set-color-ranges', (_, colorRanges) => {
  updateSettings({ appearance: { colorRanges } })
})

ipcMain.on('set-lock-overlay-to-desktop', (_, enabled: boolean) => {
  updateSettings({ general: { lockOverlayToDesktop: enabled } })
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.setVisibleOnAllWorkspaces(!enabled, { visibleOnFullScreen: !enabled })
  }
})

ipcMain.on('set-wpm-text-size', (_, size: 'medium' | 'large') => {
  updateSettings({ appearance: { wpmTextSize: size } })
  setTimeout(() => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      const bounds = mainWindow.getBounds()
      if (size === 'large') {
        mainWindow.setBounds({
          x: bounds.x,
          y: bounds.y,
          width: WINDOW_WIDTH_LARGE,
          height: WINDOW_HEIGHT_LARGE
        }, true)
      } else {
        mainWindow.setBounds({
          x: bounds.x,
          y: bounds.y,
          width: WINDOW_WIDTH,
          height: WINDOW_HEIGHT
        }, true)
      }
    }
  }, 10)
})

ipcMain.on('reset-all-settings', () => {
  const defaults = {
    general: {
      launchAtLogin: false,
      showMenuBarWpm: false,
      globalShortcut: 'Alt+Shift+W',
      lockOverlayToDesktop: false,
    },
    appearance: {
      smartColouring: true,
      wpmTextSize: 'medium' as const,
      colorRanges: {
        low: '#ef4444',
        mid: '#eab308',
        high: '#22c55e',
        ultra: '#3b82f6',
      },
    },
  }
  updateSettings(defaults)
  
  unregisterShortcut()
  registerShortcut('Alt+Shift+W')
  
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  }
  
  if (tray) {
    tray.setContextMenu(getContextMenu())
  }
})

app.on('window-all-closed', () => {
  stopTracking()
  stopWPMBroadcast()
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  showWindow()
})

app.on('before-quit', () => {
  if (isQuitting) return
  isQuitting = true

  stopTracking()
  stopWPMBroadcast()
  unregisterShortcut()

  if (fadeInterval) {
    clearInterval(fadeInterval)
    fadeInterval = null
  }
  if (opacityTimeout) {
    clearTimeout(opacityTimeout)
    opacityTimeout = null
  }
  if (moveTimeout) {
    clearTimeout(moveTimeout)
    moveTimeout = null
    if (mainWindow && !mainWindow.isDestroyed()) {
      const [x, y] = mainWindow.getPosition()
      store.set('overlayBounds', { x, y })
    }
  }

  saveSessionToLifetime()

  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.destroy()
  }
})


