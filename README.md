# CompanionLedger 陪玩财务管理系统

一款专为陪玩工作室打造的桌面端财务管理工具，基于 Electron + React + Ant Design 构建，支持接单计时、自动结算、数据分析等核心功能。

## ✨ 功能特性

- **接单记录** — 实时计时，支持按时长（15分钟制）和按把计费，自动计算费用
- **陪玩管理** — 管理陪玩人员信息，支持抽成设置（百分比/固定金额）
- **消费明细** — 老板消费记录一目了然
- **存单管理** — 充值存单跟踪管理
- **排行榜** — 陪玩接单量、收入排行
- **数据分析** — 收入走势图、今日数据看板
- **历史记录** — 历史账单查询，支持多条件筛选
- **数据同步** — Excel 导入导出，支持下载模板
- **报单模板** — 自定义报单字段，结算后一键复制
- **三套主题** — 明亮 / 暗色 / 少女粉，随心切换
- **系统托盘** — 最小化到托盘，右键菜单退出
- **更新日志** — 内置版本更新记录

## 📸 界面预览

> 首次启动后可在「系统设置」中自定义应用名称和图标

## 🛠️ 技术栈

| 类别 | 技术 |
|------|------|
| 桌面框架 | Electron 32 |
| 前端框架 | React 18 |
| UI 组件库 | Ant Design 5 |
| 构建工具 | Vite 6 |
| 路由 | React Router 6 |
| 图表 | @ant-design/charts |
| 数据存储 | 本地 JSON 文件（`%APPDATA%/companion-finance/data/`） |
| 打包工具 | electron-builder |

## 📦 安装使用

### 下载安装包

前往 [Releases](../../releases) 下载最新版本的 `.exe` 安装包，双击安装即可。

### 从源码构建

```bash
# 克隆仓库
git clone https://github.com/kkk041/CompanionLedger.git
cd CompanionLedger

# 安装依赖
npm install

# 开发模式（需要分别启动 Vite 和 Electron）
# 终端 1：启动前端
npm run dev

# 终端 2：启动 Electron
npx electron .

# 构建前端
npm run build

# 打包安装程序（Windows）
npx electron-builder --win
```

## 📁 项目结构

```
├── electron/
│   ├── main.js          # Electron 主进程
│   └── preload.js       # 预加载脚本
├── src/
│   ├── pages/
│   │   ├── OrderManagement.jsx    # 接单记录
│   │   ├── CompanionManagement.jsx # 陪玩管理
│   │   ├── BossManagement.jsx     # 消费明细
│   │   ├── DepositManagement.jsx  # 存单管理
│   │   ├── RankingBoard.jsx       # 排行榜
│   │   ├── DataAnalysis.jsx       # 数据分析
│   │   ├── HistoryRecords.jsx     # 历史记录
│   │   ├── DataSync.jsx           # 数据同步
│   │   ├── SystemSettings.jsx     # 系统设置
│   │   └── Changelog.jsx          # 更新日志
│   ├── contexts/
│   │   └── ThemeContext.jsx        # 主题上下文
│   ├── services/
│   │   └── storage.js             # 数据存储服务
│   ├── utils/
│   │   ├── format.js              # 格式化工具
│   │   └── templateParser.js      # 模板解析器
│   ├── App.jsx                    # 主布局 & 路由
│   ├── main.jsx                   # 入口文件
│   └── index.css                  # 全局样式 & 主题
├── package.json
├── vite.config.js
└── index.html
```

## 🔧 数据存储

应用数据保存在系统用户目录下，卸载重装不会丢失：

- **Windows**: `%APPDATA%/companion-finance/data/`

数据文件为 JSON 格式，支持通过「数据同步」页面导入导出 Excel。

## 📋 系统要求

- Windows 10 / 11（64 位）
- 约 200MB 磁盘空间

## 📄 许可证

[MIT License](LICENSE)

## 🔄 更新日志

### v1.2.0 (2026-04-19)
- 新增报单模板功能，结算后一键复制
- 新增更新日志页面
- 优化接单页面布局
- 系统托盘支持右键退出

### v1.1.0 (2026-04-17)
- 支持按把计费模式
- 历史账单增加计费方式筛选
- 暗色/少女主题优化

### v1.0.0 (2026-04-15)
- 首个正式版本
- 接单计时 + 自动结算
- 今日数据、收入走势、历史账单
- 三套主题切换
- 15分钟制计费
- 抽成百分比/固定金额
