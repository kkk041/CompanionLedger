import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import { ConfigProvider, App as AntdApp, theme as antdTheme } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import dayjs from 'dayjs'
import 'dayjs/locale/zh-cn'
import { ThemeProvider, useTheme } from './contexts/ThemeContext'
import App from './App'
import './index.css'

dayjs.locale('zh-cn')

function ThemedApp() {
  const { currentTheme, settings } = useTheme()
  return (
    <ConfigProvider
      locale={zhCN}
      theme={{
        token: currentTheme.token,
        algorithm: [
          currentTheme.algorithm,
          ...(settings.compactMode ? [antdTheme.compactAlgorithm] : []),
        ],
      }}
    >
      <AntdApp>
        <App />
      </AntdApp>
    </ConfigProvider>
  )
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <HashRouter>
    <ThemeProvider>
      <ThemedApp />
    </ThemeProvider>
  </HashRouter>,
)
