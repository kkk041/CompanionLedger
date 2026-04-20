import React, { createContext, useContext, useState, useEffect } from 'react'
import { theme as antdTheme } from 'antd'
import { readData, writeData } from '../services/storage'
import { defaultOrderTemplate } from '../utils/templateParser'

const SETTINGS_FILE = 'settings'

// 默认主题色
const DEFAULT_THEME_COLORS = {
  light: '#1677ff',
  dark: '#1677ff',
  pink: '#ff4fa3',
}

// 根据主色生成柔和变体（混入28%白色）
function soften(hex) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  const mix = (c) => Math.round(c + (255 - c) * 0.28)
  return `#${[mix(r), mix(g), mix(b)].map((c) => c.toString(16).padStart(2, '0')).join('')}`
}

// 生成浅色调（用于内容背景等）amount越大越接近白色
function tint(hex, amount) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  const mix = (c) => Math.round(c + (255 - c) * amount)
  return `#${[mix(r), mix(g), mix(b)].map((c) => c.toString(16).padStart(2, '0')).join('')}`
}

// 根据主色生成侧边栏渐变（粉色主题）
function pinkSiderGradient(hex) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  const dark = `rgb(${Math.round(r * 0.7)},${Math.round(g * 0.7)},${Math.round(b * 0.7)})`
  const mid = `rgb(${Math.round(r * 0.82)},${Math.round(g * 0.82)},${Math.round(b * 0.82)})`
  const light = `rgb(${Math.round(r * 0.92)},${Math.round(g * 0.92)},${Math.round(b * 0.92)})`
  return `linear-gradient(180deg, ${dark} 0%, ${mid} 50%, ${light} 100%)`
}

// 构建主题配置（接受自定义主色）
function buildThemes(customColors = {}) {
  const colors = { ...DEFAULT_THEME_COLORS, ...customColors }
  return {
    light: {
      key: 'light',
      name: '明亮主题',
      color: colors.light,
      token: {
        colorPrimary: colors.light,
        borderRadius: 6,
        colorBgContainer: '#ffffff',
        colorBgLayout: '#f5f5f5',
        colorSuccess: '#52c41a',
        colorWarning: '#fa8c16',
        colorError: '#ff4d4f',
      },
      algorithm: antdTheme.defaultAlgorithm,
      sider: {
        bg: '#001529',
        menuTheme: 'dark',
        logoBorder: 'rgba(255,255,255,0.1)',
        logoColor: '#fff',
      },
      header: {
        bg: '#ffffff',
        color: '#333',
        shadow: 'none',
      },
      content: { bg: '#f5f5f5' },
    },
    dark: {
      key: 'dark',
      name: '暗色主题',
      color: colors.dark,
      token: {
        colorPrimary: colors.dark,
        borderRadius: 6,
        colorBgContainer: '#1f1f1f',
        colorBgLayout: '#141414',
        colorBgElevated: '#1f1f1f',
        colorBorder: '#424242',
        colorText: '#e0e0e0',
        colorTextSecondary: '#a8a8a8',
        colorSuccess: '#95de64',
        colorWarning: '#ffc069',
        colorError: '#ff7875',
      },
      algorithm: antdTheme.darkAlgorithm,
      sider: {
        bg: '#0a0a0a',
        menuTheme: 'dark',
        logoBorder: 'rgba(255,255,255,0.06)',
        logoColor: '#e8e8e8',
      },
      header: {
        bg: '#1f1f1f',
        color: '#e8e8e8',
        shadow: 'none',
      },
      content: { bg: '#141414' },
    },
    pink: {
      key: 'pink',
      name: '少女主题',
      color: colors.pink,
      token: {
        colorPrimary: colors.pink,
        borderRadius: 8,
        colorBgContainer: tint(colors.pink, 0.88),
        colorBgLayout: tint(colors.pink, 0.82),
        colorLink: colors.pink,
        colorText: '#4a2035',
        colorTextSecondary: '#6b3a52',
        colorTextTertiary: '#8a5a70',
        colorBorder: tint(colors.pink, 0.6),
        colorBorderSecondary: tint(colors.pink, 0.7),
        colorSuccess: '#52c41a',
        colorWarning: '#fa8c16',
        colorError: '#eb2f96',
      },
      algorithm: antdTheme.defaultAlgorithm,
      sider: {
        bg: pinkSiderGradient(colors.pink),
        menuTheme: 'dark',
        logoBorder: 'rgba(255,255,255,0.2)',
        logoColor: '#fff',
      },
      header: {
        bg: soften(colors.pink),
        color: '#fff',
        shadow: 'none',
      },
      content: { bg: tint(colors.pink, 0.8) },
    },
  }
}

// 默认设置
const defaultSettings = {
  theme: 'light',
  themeColors: {},
  appTitle: '陪玩店管理',
  appIcon: '',
  closeAction: '',
  defaultCommissionRate: 30,
  defaultUnitPrice: 0,
  pageSize: 15,
  autoBackup: false,
  compactMode: false,
  showWelcome: true,
  currency: '¥',
  orderTemplate: defaultOrderTemplate,
}

const ThemeContext = createContext()

export function ThemeProvider({ children }) {
  const [settings, setSettings] = useState(defaultSettings)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    try {
      const saved = await readData(SETTINGS_FILE)
      if (saved && typeof saved === 'object' && !Array.isArray(saved)) {
        setSettings((prev) => ({ ...prev, ...saved }))
      }
    } catch {
      // 首次使用，无设置文件
    }
    setLoaded(true)
  }

  const updateSettings = async (newSettings) => {
    const merged = { ...settings, ...newSettings }
    setSettings(merged)
    await writeData(SETTINGS_FILE, merged)
  }

  // 根据自定义色重建主题
  const themes = buildThemes(settings.themeColors)
  const currentTheme = themes[settings.theme] || themes.light

  return (
    <ThemeContext.Provider
      value={{
        settings,
        updateSettings,
        currentTheme,
        themes,
        loaded,
      }}
    >
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}

export { defaultSettings, DEFAULT_THEME_COLORS, SETTINGS_FILE }
