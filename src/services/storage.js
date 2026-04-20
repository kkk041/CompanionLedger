// 本地数据存储服务
// 在 Electron 环境使用 IPC 读写文件，在浏览器环境使用 localStorage 作为回退

const isElectron = () => window.electronAPI !== undefined

// 数据文件名常量
export const DATA_FILES = {
  ORDERS: 'orders',
  COMPANIONS: 'companions',
  BOSSES: 'bosses',
  DEPOSITS: 'deposits',
  SETTINGS: 'settings',
}

// 读取数据
export async function readData(fileName) {
  if (isElectron()) {
    return await window.electronAPI.readData(fileName)
  }
  // 浏览器回退 (开发调试用)
  const raw = localStorage.getItem(`finance_${fileName}`)
  if (!raw) return fileName === 'settings' ? {} : []
  return JSON.parse(raw)
}

// 写入数据
export async function writeData(fileName, data) {
  if (isElectron()) {
    return await window.electronAPI.writeData(fileName, data)
  }
  localStorage.setItem(`finance_${fileName}`, JSON.stringify(data))
  return true
}

// 获取所有记录
export async function getAll(fileName) {
  return await readData(fileName)
}

// 添加记录
export async function addRecord(fileName, record) {
  const data = await readData(fileName)
  data.push(record)
  await writeData(fileName, data)
  return record
}

// 更新记录
export async function updateRecord(fileName, id, updates) {
  const data = await readData(fileName)
  const index = data.findIndex((item) => item.id === id)
  if (index !== -1) {
    data[index] = { ...data[index], ...updates }
    await writeData(fileName, data)
    return data[index]
  }
  return null
}

// 删除记录
export async function deleteRecord(fileName, id) {
  const data = await readData(fileName)
  const filtered = data.filter((item) => item.id !== id)
  await writeData(fileName, filtered)
  return true
}
