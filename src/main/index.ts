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
let wpmUpdateInterval: NodeJS.Timeout | null = null
let saveTimeout: NodeJS.Timeout | null = null

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
    if (mainWindow && !mainWindow.isDestroyed() && mainWindow.isVisible()) {
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

  mainWindow.on('move', () => {
    debouncedSavePosition()
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

function showWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    createWindow()
  } else {
    mainWindow.show()
    mainWindow.focus()
  }
}

function hideWindow() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.hide()
  }
}

function toggleWindow() {
  if (mainWindow && !mainWindow.isDestroyed() && mainWindow.isVisible()) {
    hideWindow()
  } else {
    showWindow()
  }
}

function createTray() {
  const iconPath = join(app.getAppPath(), 'public', 'icons8-circle-100.png')
  let trayIcon = nativeImage.createFromPath(iconPath)
  trayIcon = trayIcon.resize({ width: 18, height: 18 })
  trayIcon.setTemplateImage(true)
  console.log('ICON EMPTY:', trayIcon.isEmpty())
  console.log('ICON SIZE:', trayIcon.getSize())
  tray = new Tray(trayIcon)
  
  tray.on('click', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.show()
      mainWindow.focus()
    }
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
