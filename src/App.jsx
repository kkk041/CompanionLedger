import React, { useState, useEffect, useCallback } from 'react'
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom'
import { Layout, Menu, Space, Button, Modal, Checkbox, Tabs } from 'antd'
import {
  HomeOutlined,
  TeamOutlined,
  UserOutlined,
  BarChartOutlined,
  HistoryOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  SettingOutlined,
  SkinOutlined,
  WalletOutlined,
  SwapOutlined,
  MinusOutlined,
  BorderOutlined,
  CloseOutlined,
  BlockOutlined,
  TrophyOutlined,
  QuestionCircleOutlined,
  NotificationOutlined,
} from '@ant-design/icons'
import { useTheme } from './contexts/ThemeContext'

import OrderManagement from './pages/OrderManagement'
import CompanionManagement from './pages/CompanionManagement'
import BossManagement from './pages/BossManagement'
import DataAnalysis from './pages/DataAnalysis'
import HistoryRecords from './pages/HistoryRecords'
import DepositManagement from './pages/DepositManagement'
import SystemSettings from './pages/SystemSettings'
import DataSync from './pages/DataSync'
import RankingBoard from './pages/RankingBoard'
import Changelog from './pages/Changelog'

const { Sider, Content, Header } = Layout

const menuItems = [
  {
    key: '/',
    icon: <HomeOutlined />,
    label: '接单记录',
  },
  {
    key: '/companions',
    icon: <TeamOutlined />,
    label: '陪玩管理',
  },
  {
    key: '/bosses',
    icon: <UserOutlined />,
    label: '消费明细',
  },
  {
    key: '/deposits',
    icon: <WalletOutlined />,
    label: '存单管理',
  },
  {
    key: '/ranking',
    icon: <TrophyOutlined />,
    label: '排行榜',
  },
  {
    key: '/analysis',
    icon: <BarChartOutlined />,
    label: '数据分析',
  },
  {
    key: '/history',
    icon: <HistoryOutlined />,
    label: '历史记录',
  },
  {
    key: '/sync',
    icon: <SwapOutlined />,
    label: '数据同步',
  },
  {
    key: '/settings',
    icon: <SettingOutlined />,
    label: '系统设置',
  },
  {
    key: '/changelog',
    icon: <NotificationOutlined />,
    label: '更新日志',
  },
]

function App() {
  const [collapsed, setCollapsed] = useState(false)
  const [isMaximized, setIsMaximized] = useState(false)
  const [closeModalVisible, setCloseModalVisible] = useState(false)
  const [closeRemember, setCloseRemember] = useState(false)
  const [helpVisible, setHelpVisible] = useState(false)
  const [themePopVisible, setThemePopVisible] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const { settings, currentTheme, themes, updateSettings } = useTheme()

  // 默认图标使用 public/icon.png
  const defaultIconUrl = '/icon.png'

  const appIcon = settings.appIcon || defaultIconUrl
  const appTitle = settings.appTitle || '陪玩店管理'

  // 同步窗口标题
  useEffect(() => {
    document.title = appTitle
    window.electronAPI?.setWindowTitle(appTitle)
  }, [appTitle])

  // 同步窗口图标（仅自定义图标时）
  useEffect(() => {
    if (settings.appIcon) {
      window.electronAPI?.setWindowIcon(settings.appIcon)
    }
  }, [settings.appIcon])

  // 检测窗口最大化状态
  useEffect(() => {
    const checkMax = async () => {
      if (window.electronAPI?.windowIsMaximized) {
        setIsMaximized(await window.electronAPI.windowIsMaximized())
      }
    }
    checkMax()
    window.addEventListener('resize', checkMax)
    return () => window.removeEventListener('resize', checkMax)
  }, [])

  // 关闭按钮处理
  const handleClose = () => {
    const saved = settings.closeAction
    if (saved === 'quit') {
      window.electronAPI?.windowClose()
      return
    }
    if (saved === 'tray') {
      window.electronAPI?.windowHide()
      return
    }
    setCloseRemember(false)
    setCloseModalVisible(true)
  }

  const handleCloseAction = async (action) => {
    setCloseModalVisible(false)
    if (closeRemember) await updateSettings({ closeAction: action })
    // 等待弹窗关闭动画完成再执行操作，避免恢复窗口时看到残留动画
    setTimeout(() => {
      if (action === 'tray') {
        window.electronAPI?.windowHide()
      } else {
        window.electronAPI?.windowClose()
      }
    }, 250)
  }

  const onMenuClick = ({ key }) => {
    navigate(key)
  }

  const themeList = Object.values(themes)

  const handleThemeSelect = (key) => {
    setThemePopVisible(false)
    updateSettings({ theme: key })
  }

  const isSiderGradient = currentTheme.sider.bg.includes('gradient')

  return (
    <Layout className={`app-layout theme-${currentTheme.key}`}>
      <Sider
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        trigger={null}
        width={180}
        theme={currentTheme.sider.menuTheme}
        style={isSiderGradient ? { background: currentTheme.sider.bg } : {}}
        className={`app-sider theme-${currentTheme.key}`}
      >
        <div
          className={`logo ${collapsed ? 'collapsed' : ''}`}
          style={{
            borderBottomColor: currentTheme.sider.logoBorder,
            color: currentTheme.sider.logoColor,
            WebkitAppRegion: 'drag',
          }}
        >
          {collapsed ? (
            <img
              src={appIcon}
              alt="icon"
              style={{
                width: 28,
                height: 28,
                borderRadius: 4,
                objectFit: 'contain',
              }}
            />
          ) : (
            <>
              <img
                src={appIcon}
                alt="icon"
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 4,
                  marginRight: 8,
                  objectFit: 'contain',
                }}
              />
              <span
                style={{
                  fontSize: 14,
                  fontWeight: 'bold',
                  letterSpacing: 1,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {appTitle}
              </span>
            </>
          )}
        </div>
        <Menu
          theme={currentTheme.sider.menuTheme}
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={onMenuClick}
          style={{
            flex: 1,
            ...(isSiderGradient ? { background: 'transparent' } : {}),
          }}
        />
        <div
          className="sider-collapse-trigger"
          onClick={() => setCollapsed(!collapsed)}
          style={{
            height: 40,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            borderTop: `1px solid ${currentTheme.sider.logoBorder}`,
            color: currentTheme.sider.logoColor,
            fontSize: 16,
            opacity: 0.8,
            flexShrink: 0,
          }}
        >
          {React.createElement(
            collapsed ? MenuUnfoldOutlined : MenuFoldOutlined,
          )}
        </div>
      </Sider>
      <Layout>
        <Header
          className="app-header"
          style={{
            padding: '0 16px',
            background: currentTheme.header.bg,
            display: 'flex',
            alignItems: 'center',
            boxShadow: currentTheme.header.shadow,
            color: currentTheme.header.color,
            zIndex: 1,
            WebkitAppRegion: 'drag',
            height: 48,
            lineHeight: '48px',
          }}
        >
          <span style={{ flex: 1 }} />
          <div
            className="header-icon-btn"
            title="使用帮助"
            onClick={() => setHelpVisible(true)}
            style={{
              WebkitAppRegion: 'no-drag',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 32,
              height: 32,
              cursor: 'pointer',
              color: currentTheme.header.color,
              fontSize: 16,
              borderRadius: 6,
            }}
          >
            <QuestionCircleOutlined />
          </div>
          <div
            className="theme-switcher"
            style={{ position: 'relative', WebkitAppRegion: 'no-drag' }}
          >
            <div
              className="header-icon-btn"
              title="切换主题"
              onClick={() => setThemePopVisible((v) => !v)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 32,
                height: 32,
                cursor: 'pointer',
                color: currentTheme.header.color,
                fontSize: 16,
                borderRadius: 6,
              }}
            >
              <SkinOutlined />
            </div>
            {themePopVisible && (
              <>
                <div
                  className="theme-pop-mask"
                  onClick={() => setThemePopVisible(false)}
                />
                <div className="theme-pop-panel">
                  {themeList.map((t) => (
                    <div
                      key={t.key}
                      className={`theme-pop-item ${t.key === currentTheme.key ? 'active' : ''}`}
                      onClick={() => handleThemeSelect(t.key)}
                    >
                      <span
                        className="theme-pop-dot"
                        style={{ background: t.color }}
                      />
                      <span>{t.name}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
          <div
            className="window-controls"
            style={{
              WebkitAppRegion: 'no-drag',
              display: 'flex',
              marginLeft: 8,
            }}
          >
            <Button
              type="text"
              size="small"
              icon={<MinusOutlined />}
              onClick={() => window.electronAPI?.windowMinimize()}
              style={{ color: currentTheme.header.color }}
            />
            <Button
              type="text"
              size="small"
              icon={isMaximized ? <BlockOutlined /> : <BorderOutlined />}
              onClick={() => window.electronAPI?.windowMaximize()}
              style={{ color: currentTheme.header.color }}
            />
            <Button
              type="text"
              size="small"
              icon={<CloseOutlined />}
              onClick={handleClose}
              className="window-close-btn"
              style={{ color: currentTheme.header.color }}
            />
          </div>
        </Header>
        <Content
          className="app-content"
          style={{ background: currentTheme.content.bg }}
        >
          <div className="page-transition" key={location.pathname}>
            <Routes>
              <Route path="/" element={<OrderManagement />} />
              <Route path="/companions" element={<CompanionManagement />} />
              <Route path="/bosses" element={<BossManagement />} />
              <Route path="/deposits" element={<DepositManagement />} />
              <Route path="/ranking" element={<RankingBoard />} />
              <Route path="/analysis" element={<DataAnalysis />} />
              <Route path="/history" element={<HistoryRecords />} />
              <Route path="/sync" element={<DataSync />} />
              <Route path="/settings" element={<SystemSettings />} />
              <Route path="/changelog" element={<Changelog />} />
            </Routes>
          </div>
        </Content>
      </Layout>

      <Modal
        title="关闭窗口"
        open={closeModalVisible}
        onCancel={() => setCloseModalVisible(false)}
        centered
        footer={
          <Space>
            <Button onClick={() => handleCloseAction('quit')}>直接退出</Button>
            <Button type="primary" onClick={() => handleCloseAction('tray')}>
              最小化到托盘
            </Button>
          </Space>
        }
      >
        <p style={{ marginBottom: 12 }}>请选择关闭方式：</p>
        <Checkbox
          checked={closeRemember}
          onChange={(e) => setCloseRemember(e.target.checked)}
        >
          以后不再提醒
        </Checkbox>
      </Modal>

      <Modal
        title="📖 使用指南"
        open={helpVisible}
        onCancel={() => setHelpVisible(false)}
        centered
        width={580}
        footer={
          <Button type="primary" onClick={() => setHelpVisible(false)}>
            我知道了
          </Button>
        }
      >
        <Tabs
          defaultActiveKey="1"
          size="small"
          items={[
            {
              key: '1',
              label: '📋 日常操作',
              children: (
                <div
                  style={{
                    fontSize: 14,
                    lineHeight: 2,
                    maxHeight: 380,
                    overflow: 'auto',
                  }}
                >
                  <h4>🏠 接单记录（首页）</h4>
                  <p>
                    这是你日常用的最多的页面。每来一单就点右上角的「新增订单」，选好老板、陪玩、填上时长和金额，系统会自动帮你算好抽成和陪玩到手金额。订单列表支持搜索、筛选和编辑，录错了随时改。表格上方有汇总栏，当日/筛选结果的总金额、总时长一目了然。
                  </p>
                  <h4>👥 陪玩管理</h4>
                  <p>
                    把店里所有陪玩都加到这里来。添加的时候可以填昵称、联系方式、擅长项目等信息。添加好之后，新增订单时就能从下拉框直接选人，省去每次手动输入。还能看到每个陪玩的累计接单量和收入汇总。
                  </p>
                  <h4>💰 消费明细</h4>
                  <p>
                    管理所有老板（客户）的信息。可以记录老板昵称、联系方式、来源渠道（比如某鱼、贴吧、朋友介绍等）。这里能看到每个老板历史消费了多少钱、下了多少单，方便识别大客户和高频客户，做针对性维护。
                  </p>
                </div>
              ),
            },
            {
              key: '2',
              label: '💰 财务管理',
              children: (
                <div
                  style={{
                    fontSize: 14,
                    lineHeight: 2,
                    maxHeight: 380,
                    overflow: 'auto',
                  }}
                >
                  <h4>📋 存单管理</h4>
                  <p>
                    老板预充值了钱就在这里建一张存单，填上充值金额和折扣。之后下单时选择对应的存单，系统会自动按折扣价扣减余额，余额不足时会提醒。可以随时查看每张存单的剩余金额和使用记录，账目清清楚楚。
                  </p>
                  <h4>🏆 排行榜</h4>
                  <p>
                    直观展示陪玩和老板的排名。分「陪玩榜」和「老板榜」两个维度，支持按今日、本周、本月切换时间范围。陪玩榜会显示接单金额、接单时长、接单数量三个排行；老板榜则显示消费金额、下单次数、消费时长。前三名自带金银铜牌动效，一眼就能看出谁是店里的MVP。
                  </p>
                  <h4>📊 数据分析</h4>
                  <p>
                    选一个时间段，系统会自动生成这段时间的经营数据报表：总订单数、总流水、总利润、各陪玩的业绩占比等等。有柱状图和饼图辅助展示，适合周报月报做总结，也能帮你看出哪些陪玩产出高、哪些时间段订单多。
                  </p>
                </div>
              ),
            },
            {
              key: '3',
              label: '⚙️ 系统功能',
              children: (
                <div
                  style={{
                    fontSize: 14,
                    lineHeight: 2,
                    maxHeight: 380,
                    overflow: 'auto',
                  }}
                >
                  <h4>📜 历史记录</h4>
                  <p>
                    所有历史订单按时间倒序排列。支持按日期范围筛选、按陪玩或老板名字搜索。想查上个月某天的单子，或者找某个陪玩过去接了多少单，来这里翻就对了。支持导出为
                    Excel 方便归档。
                  </p>
                  <h4>🔄 数据同步</h4>
                  <p>
                    一键把所有数据导出为备份文件，也能从备份文件一键恢复。换电脑、重装系统之前记得先导出一份！还支持导出
                    Excel 报表，给合伙人看账或者自己存档都方便。
                  </p>
                  <h4>⚙️ 系统设置</h4>
                  <p>
                    可以改店铺名称（左上角显示的标题）、更换店铺图标、设置默认抽成比例（新建订单会自动填上）。还有关闭行为设置——可以选直接退出还是缩到托盘后台运行。
                  </p>
                  <h4>🎨 换主题</h4>
                  <p>
                    点右上角衣服图标，可以在「明亮」「暗色」「少女粉」三种风格之间切换。暗色主题适合晚上用不刺眼，少女粉适合喜欢可爱风格的店长～
                  </p>
                </div>
              ),
            },
          ]}
        />
      </Modal>
    </Layout>
  )
}

export default App
