const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  readData: (fileName) => ipcRenderer.invoke('data:read', fileName),
  writeData: (fileName, data) =>
    ipcRenderer.invoke('data:write', fileName, data),
  getDataPath: () => ipcRenderer.invoke('data:getPath'),
  windowMinimize: () => ipcRenderer.invoke('window:minimize'),
  windowMaximize: () => ipcRenderer.invoke('window:maximize'),
  windowClose: () => ipcRenderer.invoke('window:close'),
  windowHide: () => ipcRenderer.invoke('window:hide'),
  windowIsMaximized: () => ipcRenderer.invoke('window:isMaximized'),
  setWindowTitle: (title) => ipcRenderer.invoke('window:setTitle', title),
  setWindowIcon: (dataUrl) => ipcRenderer.invoke('window:setIcon', dataUrl),
  appRelaunch: () => ipcRenderer.invoke('app:relaunch'),
  saveFile: (options) => ipcRenderer.invoke('dialog:saveExcel', options),
  openFile: () => ipcRenderer.invoke('dialog:openExcel'),
})
