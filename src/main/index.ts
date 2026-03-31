import { app, BrowserWindow, screen, Tray, Menu, nativeImage, ipcMain } from 'electron'
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
let saveTimeout: NodeJS.Timeout | null = null
let fadeInterval: NodeJS.Timeout | null = null
let lastMenuBarWpm = 0
let menuBarAnimationTimeouts: NodeJS.Timeout[] = []

const SETTINGS_WIDTH = 780
const SETTINGS_HEIGHT = 560

const WINDOW_WIDTH = 145
const WINDOW_HEIGHT = 100
const preload = join(__dirname, '../preload/index.js')

const store = new Store({
  name: 'window-position',
  defaults: {
    x: undefined,
    y: undefined
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

function getSavedPosition() {
  const savedX = store.get('x') as number | undefined
  const savedY = store.get('y') as number | undefined
  
  if (savedX !== undefined && savedY !== undefined) {
    return { x: savedX, y: savedY }
  }
  
  const { width } = screen.getPrimaryDisplay().workAreaSize
  return {
    x: Math.round(width - WINDOW_WIDTH - 10),
    y: 30
  }
}

function savePosition() {
  if (!mainWindow || mainWindow.isDestroyed()) return
  
  const [x, y] = mainWindow.getPosition()
  store.set('x', x)
  store.set('y', y)
}

function debouncedSavePosition() {
  if (saveTimeout) {
    clearTimeout(saveTimeout)
  }
  saveTimeout = setTimeout(savePosition, 200)
}

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
        smartColouring: settings.appearance.smartColouring
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

function createWindow() {
  const pos = getSavedPosition()
  
  mainWindow = new BrowserWindow({
    width: WINDOW_WIDTH,
    height: WINDOW_HEIGHT,
    x: pos.x,
    y: pos.y,
    frame: false,
    transparent: true,
    resizable: false,
    movable: true,
    minimizable: false,
    maximizable: false,
    closable: false,
    alwaysOnTop: true,
    skipTaskbar: false,
    show: true,
    webPreferences: {
      preload,
      nodeIntegration: false,
      contextIsolation: true,
    },
    backgroundColor: '#00000000',
  })

  mainWindow.setAlwaysOnTop(true)
  mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })

  mainWindow.on('move', () => {
    debouncedSavePosition()
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
  }
  opacityTimeout = setTimeout(() => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.setOpacity(Math.min(1, Math.max(0.3, opacity)))
    }
  }, 50)
}

function toggleWindow() {
  if (mainWindow && !mainWindow.isDestroyed() && mainWindow.isVisible()) {
    hideWindow()
  } else {
    showWindow()
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
    transparent: true,
    vibrancy: 'hud',
    visualEffectState: 'active',
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

    return Menu.buildFromTemplate([
      {
        label: isVisible ? 'Hide' : 'Show',
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
  
  createWindow()
  
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.setOpacity(settings.display.opacity)
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

ipcMain.on('set-opacity', (_, opacity: number) => {
  updateSettings({ display: { opacity } })
  setOverlayOpacity(opacity)
})

ipcMain.on('set-smart-colouring', (_, enabled: boolean) => {
  updateSettings({ appearance: { smartColouring: enabled } })
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


