import { app, BrowserWindow, screen, Tray, Menu, nativeImage } from 'electron'
import { join } from 'path'
import { initTracking, stopTracking, getWPM } from './keyboardTracker'
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

function startWPMBroadcast() {
  if (wpmUpdateInterval) return
  
  wpmUpdateInterval = setInterval(() => {
    if (mainWindow && !mainWindow.isDestroyed() && mainWindow.isVisible() && !mainWindow.webContents.isDestroyed()) {
      const stats = getWPM()
      mainWindow.webContents.send('wpm:update', stats)
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

function toggleWindow() {
  if (mainWindow && !mainWindow.isDestroyed() && mainWindow.isVisible()) {
    hideWindow()
  } else {
    showWindow()
  }
}

function createSettingsWindow() {
  console.log('createSettingsWindow called')
  
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    console.log('Settings window already exists, focusing')
    settingsWindow.focus()
    return
  }

  const { width, height } = screen.getPrimaryDisplay().workAreaSize

  settingsWindow = new BrowserWindow({
    width: SETTINGS_WIDTH,
    height: SETTINGS_HEIGHT,
    x: Math.round((width - SETTINGS_WIDTH) / 2),
    y: Math.round((height - SETTINGS_HEIGHT) / 2),
    frame: true,
    resizable: false,
    minimizable: false,
    maximizable: false,
    show: true,
    webPreferences: {
      preload,
      nodeIntegration: false,
      contextIsolation: true,
    },
    backgroundColor: '#121212',
  })

  const baseUrl = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173'
  const settingsUrl = baseUrl.endsWith('/') ? `${baseUrl}#/settings` : `${baseUrl}/#/settings`
  
  console.log('Loading settings URL:', settingsUrl)
  settingsWindow.loadURL(settingsUrl)

  settingsWindow.webContents.on('did-finish-load', () => {
    console.log('Settings window loaded')
  })

  settingsWindow.on('closed', () => {
    console.log('Settings window closed')
    settingsWindow = null
  })
}

function createTray() {
  if (tray) {
    tray.destroy()
  }
  
  const iconPath = join(__dirname, '../../public/trayTemplate.png')
  let trayIcon = nativeImage.createFromPath(iconPath)
  
  if (trayIcon.isEmpty()) {
    console.error('Tray icon failed to load')
  }
  
  trayIcon = trayIcon.resize({ width: 16, height: 16 })
  trayIcon.setTemplateImage(true)
  
  console.log('Tray recreated with updated icon')
  console.log('Icon path:', iconPath)
  
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
        click: () => {
          console.log('Stats clicked')
        }
      },
      {
        label: 'Settings',
        click: () => {
          console.log('Settings menu clicked')
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
  createWindow()
  createTray()
  initTracking()
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


