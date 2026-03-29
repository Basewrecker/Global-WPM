import { app, BrowserWindow, screen, Tray, Menu, nativeImage } from 'electron'
import { join } from 'path'
import { initTracking, stopTracking, getWPM } from './keyboardTracker'

process.env.DIST_ELECTRON = join(__dirname, '..')
process.env.DIST = join(process.env.DIST_ELECTRON, '../dist')
process.env.VITE_PUBLIC = process.env.VITE_DEV_SERVER_URL
  ? join(process.env.DIST_ELECTRON, '../public')
  : join(process.env.DIST, '../public')

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null
let wpmUpdateInterval: NodeJS.Timeout | null = null

const WINDOW_WIDTH = 145
const WINDOW_HEIGHT = 100
const preload = join(__dirname, '../preload/index.js')

function getScreenPosition() {
  const { width } = screen.getPrimaryDisplay().workAreaSize
  return {
    x: Math.round(width - WINDOW_WIDTH - 10),
    y: 30
  }
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
  const pos = getScreenPosition()
  
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
    const pos = getScreenPosition()
    mainWindow.setPosition(pos.x, pos.y, false)
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
  const iconPath = join(process.env.VITE_PUBLIC, 'tray-icon.png')
  const icon = nativeImage.createFromPath(iconPath)
  
  tray = new Tray(icon)
  tray.setToolTip('WPM Tracker')
  
  tray.on('click', () => {
    toggleWindow()
  })
  
  tray.on('right-click', () => {
    const contextMenu = Menu.buildFromTemplate([
      { label: 'Show', click: showWindow },
      { label: 'Hide', click: hideWindow },
      { type: 'separator' },
      { label: 'Quit', click: () => app.quit() }
    ])
    tray?.popUpContextMenu(contextMenu)
  })
}

app.whenReady().then(() => {
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
