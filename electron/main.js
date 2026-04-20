const {
  app,
  BrowserWindow,
  ipcMain,
  Menu,
  nativeImage,
  Tray,
  dialog,
} = require('electron')
const path = require('path')
const fs = require('fs')

// 数据存储目录
const DATA_DIR = path.join(app.getPath('userData'), 'data')

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true })
  }
}

function getDataFilePath(fileName) {
  return path.join(DATA_DIR, `${fileName}.json`)
}

function readData(fileName) {
  const filePath = getDataFilePath(fileName)
  if (!fs.existsSync(filePath)) {
    return fileName === 'settings' ? {} : []
  }
  const raw = fs.readFileSync(filePath, 'utf-8')
  return JSON.parse(raw)
}

function writeData(fileName, data) {
  ensureDataDir()
  const filePath = getDataFilePath(fileName)
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8')
}

let mainWindow
let tray = null

function createWindow() {
  // 读取保存的设置，获取自定义图标和标题
  let customIcon = null
  let customTitle = '陪玩店管理'
  try {
    const settingsPath = getDataFilePath('settings')
    if (fs.existsSync(settingsPath)) {
      const saved = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'))
      if (saved.appTitle) customTitle = saved.appTitle
      if (saved.appIcon) {
        const base64Match = saved.appIcon.match(/^data:[^;]+;base64,(.+)$/)
        if (base64Match) {
          const buf = Buffer.from(base64Match[1], 'base64')
          const img = nativeImage.createFromBuffer(buf)
          if (!img.isEmpty()) {
            customIcon = img.resize({ width: 64, height: 64 })
          }
        }
      }
    }
  } catch {}

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 680,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    title: customTitle,
    icon: customIcon || path.join(__dirname, '../public/icon.png'),
    frame: false,
  })

  // 开发环境加载 vite dev server，生产环境加载打包文件
  if (process.env.NODE_ENV === 'development' || !app.isPackaged) {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }
}

app.whenReady().then(() => {
  ensureDataDir()
  Menu.setApplicationMenu(null)
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// IPC 数据操作接口
ipcMain.handle('data:read', (_, fileName) => {
  return readData(fileName)
})

ipcMain.handle('data:write', (_, fileName, data) => {
  writeData(fileName, data)
  return true
})

ipcMain.handle('data:getPath', () => {
  return DATA_DIR
})

// 窗口控制
ipcMain.handle('window:minimize', () => {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.minimize()
})
ipcMain.handle('window:maximize', () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize()
    } else {
      mainWindow.maximize()
    }
  }
})
ipcMain.handle('window:close', () => {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.close()
})
ipcMain.handle('window:hide', () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.hide()
    // 创建托盘图标
    if (!tray || tray.isDestroyed()) {
      const iconPath = path.join(__dirname, '../public/icon.png')
      let trayIcon
      try {
        // 优先使用自定义图标
        const settingsPath = getDataFilePath('settings')
        if (fs.existsSync(settingsPath)) {
          const saved = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'))
          if (saved.appIcon) {
            const base64Match = saved.appIcon.match(/^data:[^;]+;base64,(.+)$/)
            if (base64Match) {
              const buf = Buffer.from(base64Match[1], 'base64')
              const img = nativeImage.createFromBuffer(buf)
              if (!img.isEmpty())
                trayIcon = img.resize({ width: 32, height: 32 })
            }
          }
        }
      } catch {}
      if (!trayIcon)
        trayIcon = nativeImage
          .createFromPath(iconPath)
          .resize({ width: 32, height: 32 })
      tray = new Tray(trayIcon)
      tray.setToolTip(mainWindow.getTitle() || '陪玩店管理')
      const contextMenu = Menu.buildFromTemplate([
        {
          label: '显示窗口',
          click: () => {
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.show()
              mainWindow.focus()
            }
          },
        },
        { type: 'separator' },
        {
          label: '退出',
          click: () => {
            if (tray && !tray.isDestroyed()) {
              tray.destroy()
              tray = null
            }
            app.quit()
          },
        },
      ])
      tray.setContextMenu(contextMenu)
      tray.on('click', () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.show()
          mainWindow.focus()
        }
      })
      tray.on('double-click', () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.show()
          mainWindow.focus()
        }
      })
    }
  }
})
ipcMain.handle('app:relaunch', () => {
  app.relaunch()
  app.exit(0)
})
ipcMain.handle('window:isMaximized', () => {
  if (mainWindow && !mainWindow.isDestroyed()) return mainWindow.isMaximized()
  return false
})
ipcMain.handle('window:setTitle', (_, title) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.setTitle(title || '陪玩店管理')
  }
})
ipcMain.handle('window:setIcon', (_, dataUrl) => {
  try {
    if (mainWindow && !mainWindow.isDestroyed() && dataUrl) {
      // 支持所有 data URL 格式
      const base64Match = dataUrl.match(/^data:[^;]+;base64,(.+)$/)
      if (base64Match) {
        const buf = Buffer.from(base64Match[1], 'base64')
        const img = nativeImage.createFromBuffer(buf)
        if (!img.isEmpty()) {
          // Windows 任务栏需要合适尺寸
          const resized = img.resize({ width: 64, height: 64 })
          mainWindow.setIcon(resized)
        }
      }
    }
  } catch (e) {
    console.error('setIcon error:', e)
  }
})

// Excel 导出对话框
let XLSX
try {
  XLSX = require('xlsx')
} catch (e) {
  console.warn('xlsx not found')
}

ipcMain.handle('dialog:saveExcel', async (_, { defaultName, sheets }) => {
  if (!XLSX) return { success: false, error: 'xlsx库未安装' }
  const result = await dialog.showSaveDialog(mainWindow, {
    title: '导出数据表格',
    defaultPath: defaultName || '数据导出.xlsx',
    filters: [{ name: 'Excel 表格', extensions: ['xlsx'] }],
  })
  if (!result.canceled && result.filePath) {
    const wb = XLSX.utils.book_new()
    for (const { name, data, header } of sheets) {
      const ws = XLSX.utils.json_to_sheet(data, { header })
      // 设置列宽
      if (data.length > 0) {
        const keys = header || Object.keys(data[0])
        ws['!cols'] = keys.map((k) => {
          const maxLen = Math.max(
            k.length,
            ...data.map((r) => String(r[k] || '').length),
          )
          return { wch: Math.min(Math.max(maxLen + 2, 8), 30) }
        })
      }
      XLSX.utils.book_append_sheet(wb, ws, name)
    }
    XLSX.writeFile(wb, result.filePath)
    return { success: true, filePath: result.filePath }
  }
  return { success: false }
})

// Excel 导入对话框
ipcMain.handle('dialog:openExcel', async () => {
  if (!XLSX) return { success: false, error: 'xlsx库未安装' }
  const result = await dialog.showOpenDialog(mainWindow, {
    title: '选择要导入的表格文件',
    filters: [{ name: 'Excel 表格', extensions: ['xlsx', 'xls'] }],
    properties: ['openFile'],
  })
  if (!result.canceled && result.filePaths.length > 0) {
    const wb = XLSX.readFile(result.filePaths[0])
    const sheets = {}
    for (const name of wb.SheetNames) {
      sheets[name] = XLSX.utils.sheet_to_json(wb.Sheets[name])
    }
    return { success: true, sheets, filePath: result.filePaths[0] }
  }
  return { success: false }
})
