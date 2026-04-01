import { app, BrowserWindow, screen, Tray, Menu, nativeImage, ipcMain, globalShortcut } from 'electron'
import { join } from 'path'
import { initTracking, stopTracking, getWPM } from './keyboardTracker'
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
let wpmUpdateInterval: NodeJS.Timeout | null = null
let fadeInterval: NodeJS.Timeout | null = null
let saveTimeout: NodeJS.Timeout | null = null
let lastMenuBarWpm = 0
let menuBarAnimationTimeouts: NodeJS.Timeout[] = []
let registeredShortcut: string | null = null
let hasSavedPosition = false

const SETTINGS_WIDTH = 780
const SETTINGS_HEIGHT = 560

const WINDOW_WIDTH = 145
const WINDOW_HEIGHT = 100
const WINDOW_WIDTH_LARGE = 180
const WINDOW_HEIGHT_LARGE = 110
const preload = join(__dirname, '../preload/index.js')

const store = new Store({
  name: 'window-position',
  defaults: {
    overlayBounds: null as { x: number; y: number } | null
  }
})

function safeSend(win: BrowserWindow | null, channel: string, data?: unknown) {
  try {
    if (!win) return
    if (win.isDestroyed()) return
    if (!win.webContents) return
    if (win.webContents.isDestroyed()) return

    win.webContents.send(channel, data)
  } catch {
    // DO NOTHING
  }
}

let opacityTimeout: NodeJS.Timeout | null = null

function getMenuBarWpm(wpm: number): string {
  if (Number(wpm) === 0) return `${wpm}`
  if (wpm <= 60) return `\x1b[31m${wpm}\x1b[0m`
  if (wpm <= 90) return `\x1b[33m${wpm}\x1b[0m`
  if (wpm <= 120) return `\x1b[32m${wpm}\x1b[0m`
  return `\x1b[34m${wpm}\x1b[0m`
}

function animateMenuBarWpm(newWpm: number) {
  menuBarAnimationTimeouts.forEach(t => clearTimeout(t))
  menuBarAnimationTimeouts = []

  if (Math.abs(newWpm - lastMenuBarWpm) <= 5) {
    if (tray) tray.setTitle(getMenuBarWpm(newWpm))
    lastMenuBarWpm = newWpm
    return
  }

  const steps = 5
  const stepTime = 40

  for (let i = 1; i <= steps; i++) {
    const timeout = setTimeout(() => {
      if (tray) {
        const value = Math.round(lastMenuBarWpm + (newWpm - lastMenuBarWpm) * (i / steps))
        tray.setTitle(getMenuBarWpm(value))
      }
    }, i * stepTime)
    menuBarAnimationTimeouts.push(timeout)
  }

  const finalTimeout = setTimeout(() => {
    lastMenuBarWpm = newWpm
  }, steps * stepTime + 10)
  menuBarAnimationTimeouts.push(finalTimeout)
}

function startWPMBroadcast() {
  if (wpmUpdateInterval) return
  
  wpmUpdateInterval = setInterval(() => {
    if (mainWindow && !mainWindow.isDestroyed() && mainWindow.isVisible()) {
      const settings = getSettings()
      const stats = getWPM()
      safeSend(mainWindow, 'wpm:update', {
        ...stats,
        smartColouring: settings.appearance.smartColouring,
        wpmTextSize: settings.appearance.wpmTextSize,
        colorRanges: settings.appearance.colorRanges,
        opacity: settings.display.opacity,
        blur: settings.display.blur
      })
      
      if (tray) {
        if (settings.general.showMenuBarWpm) {
          animateMenuBarWpm(stats.wpm)
        } else {
          tray.setTitle('')
          lastMenuBarWpm = 0
        }
      }
    }
  }, 500)
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

function createWindow() {
  const savedBounds = store.get('overlayBounds') as { x: number; y: number } | null
  hasSavedPosition = savedBounds !== null && typeof savedBounds.x === 'number' && typeof savedBounds.y === 'number'
  
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
  })

  mainWindow.setMovable(true)
  mainWindow.setAlwaysOnTop(true, 'floating')
  mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  mainWindow.setBackgroundColor('#00000000')

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

  let moveTimeout: NodeJS.Timeout | null = null
  mainWindow.on('move', () => {
    if (moveTimeout) clearTimeout(moveTimeout)
    moveTimeout = setTimeout(() => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        const [x, y] = mainWindow.getPosition()
        store.set('overlayBounds', { x, y })
      }
    }, 200)
  })

  mainWindow.on('close', (e) => {
    e.preventDefault()
    hideWindowAnimated()
  })

  mainWindow.on('closed', () => {
    stopWPMBroadcast()
    if (fadeInterval) {
      clearInterval(fadeInterval)
      fadeInterval = null
    }
    if (saveTimeout) {
      clearTimeout(saveTimeout)
      saveTimeout = null
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
    mainWindow?.show()
    mainWindow?.focus()
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
    mainWindow.focus()
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

  const baseUrl = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173'
  const settingsUrl = baseUrl.endsWith('/') ? `${baseUrl}#/settings` : `${baseUrl}/#/settings`
  
  settingsWindow.loadURL(settingsUrl)

  settingsWindow.on('closed', () => {
    settingsWindow = null
  })
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
            mainWindow.focus()
          }
        }
      },
      { type: 'separator' },
      {
        label: 'Stats',
        click: () => {}
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
        click: () => process.exit(0)
      }
    ])
  }

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
})

ipcMain.on('set-launch-at-login', (_, enabled: boolean) => {
  app.setLoginItemSettings({ openAtLogin: enabled })
  updateSettings({ general: { launchAtLogin: enabled } })
})

ipcMain.on('set-show-menu-bar-wpm', (_, enabled: boolean) => {
  updateSettings({ general: { showMenuBarWpm: enabled } })
  if (tray) {
    if (!enabled) {
      tray.setTitle('')
      lastMenuBarWpm = 0
    } else {
      const stats = getWPM()
      tray.setTitle('')
      setTimeout(() => tray?.setTitle(getMenuBarWpm(Math.round(stats.wpm * 0.6))), 40)
      setTimeout(() => tray?.setTitle(getMenuBarWpm(Math.round(stats.wpm * 0.8))), 80)
      setTimeout(() => tray?.setTitle(getMenuBarWpm(stats.wpm)), 120)
      lastMenuBarWpm = stats.wpm
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
  if (enabled) {
    mainWindow.setVibrancy('under-window')
  } else {
    mainWindow.setVibrancy('none')
  }
})

ipcMain.on('set-smart-colouring', (_, enabled: boolean) => {
  updateSettings({ appearance: { smartColouring: enabled } })
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

app.on('will-quit', () => {
  unregisterShortcut()
})

app.on('before-quit', () => {
  if (saveTimeout) {
    clearTimeout(saveTimeout)
    saveTimeout = null
  }
})


