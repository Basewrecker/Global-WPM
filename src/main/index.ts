import { app, BrowserWindow, ipcMain, screen, globalShortcut } from 'electron'
import { join } from 'path'
import { initTracking, stopTracking, getKeystrokes, getKeystrokeCount, getWPM } from './keyboardTracker'

process.env.DIST_ELECTRON = join(__dirname, '..')
process.env.DIST = join(process.env.DIST_ELECTRON, '../dist')
process.env.VITE_PUBLIC = process.env.VITE_DEV_SERVER_URL
  ? join(process.env.DIST_ELECTRON, '../public')
  : process.env.DIST

let mainWindow: BrowserWindow | null = null
let wpmUpdateInterval: NodeJS.Timeout | null = null

const preload = join(__dirname, '../preload/index.js')

function startWPMBroadcast() {
  if (wpmUpdateInterval) return
  
  wpmUpdateInterval = setInterval(() => {
    if (mainWindow && !mainWindow.isDestroyed()) {
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

function toggleDevTools() {
  if (mainWindow) {
    if (mainWindow.webContents.isDevToolsOpened()) {
      mainWindow.webContents.closeDevTools()
    } else {
      mainWindow.webContents.openDevTools()
    }
  }
}

function registerShortcuts() {
  globalShortcut.register('CommandOrControl+Option+I', toggleDevTools)
}

function createWindow() {
  const display = screen.getPrimaryDisplay()
  const { width } = display.workAreaSize
  
  mainWindow = new BrowserWindow({
    width: 120,
    height: 100,
    x: width - 140,
    y: 16,
    frame: false,
    transparent: true,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    closable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    focusable: true,
    hasShadow: false,
    opacity: 1,
    webPreferences: {
      preload,
      nodeIntegration: false,
      contextIsolation: true,
    },
    backgroundColor: '#00000000',
    show: false,
  })

  mainWindow.setIgnoreMouseEvents(false)

  mainWindow.on('mouseenter', () => {
    mainWindow?.setIgnoreMouseEvents(false)
  })

  mainWindow.on('mouseleave', () => {
    mainWindow?.setIgnoreMouseEvents(true)
  })

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
  } else {
    mainWindow.loadFile(join(process.env.DIST, 'index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

app.whenReady().then(() => {
  createWindow()
  registerShortcuts()
  initTracking()
  startWPMBroadcast()
})

app.on('window-all-closed', () => {
  globalShortcut.unregisterAll()
  stopTracking()
  stopWPMBroadcast()
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

ipcMain.handle('keystrokes:get', () => getKeystrokes())
ipcMain.handle('keystrokes:count', () => getKeystrokeCount())
ipcMain.handle('wpm:get', () => getWPM())
