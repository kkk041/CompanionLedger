import React, { useState } from 'react'
import {
  Card,
  Button,
  DatePicker,
  Space,
  Row,
  Col,
  message,
  Alert,
  Tag,
  Table,
  Typography,
  Divider,
  Radio,
} from 'antd'
import {
  ExportOutlined,
  ImportOutlined,
  CheckCircleOutlined,
  InfoCircleOutlined,
  FileExcelOutlined,
  DownloadOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import { v4 as uuidv4 } from 'uuid'
import { getAll, writeData, DATA_FILES } from '../services/storage'
import { useTheme } from '../contexts/ThemeContext'
import { defaultOrderTemplate } from '../utils/templateParser'

const { RangePicker } = DatePicker
const { Text } = Typography

// 订单字段中文映射
const ORDER_HEADERS = {
  id: '记录编号',
  date: '日期',
  manager: '管理',
  bossName: '老板',
  companionName: '陪玩',
  orderType: '类型',
  timeRange: '起止时间',
  duration: '时长',
  unitPrice: '单价',
  totalAmount: '总计',
  commissionAmount: '抽成',
  actualIncome: '到手',
  isDirect: '直属',
  depositDeduction: '存单扣款',
  depositDiscount: '存单折扣',
  createdAt: '创建时间',
  bossId: '老板编号',
  companionId: '陪玩编号',
  depositId: '存单编号',
}

const COMPANION_TEMPLATE_HEADERS = {
  name: '姓名',
  contact: '联系方式',
  remark: '备注',
}

const BOSS_TEMPLATE_HEADERS = {
  name: '姓名',
  contact: '联系方式',
  remark: '备注',
}

const DEPOSIT_TEMPLATE_HEADERS = {
  bossName: '老板',
  depositAmount: '充值金额',
  bonusAmount: '赠送金额',
  totalBalance: '总额度',
  remainingBalance: '剩余余额',
  discountRate: '折扣率',
  status: '状态',
}

// 根据模板字段生成示例值
function getSampleValue(field, rowIndex) {
  const samples = {
    date: ['2026-04-18', '2026-04-18'],
    manager: ['小王', '小王'],
    bossName: ['张总', '李总'],
    companionName: ['小美', '小花'],
    orderType: ['王者荣耀', '和平精英'],
    timeRange: ['14:00-16:00', '20:00-22:00'],
    duration: [2, 2],
    unitPrice: [30, 35],
    totalAmount: [60, 70],
    commissionAmount: [12, 14],
    actualIncome: [48, 56],
    isDirect: ['否', '是'],
  }
  if (samples[field.key]) return samples[field.key][rowIndex] ?? ''
  // 自定义字段按类型给示例
  if (field.type === 'number') return rowIndex === 0 ? 100 : 200
  if (field.type === 'date') return '2026-04-18'
  return rowIndex === 0 ? '示例1' : '示例2'
}

// 固定的陪玩/老板/存单模板示例数据
const FIXED_SAMPLE_DATA = {
  companions: [
    { 姓名: '小美', 联系方式: '13800138001', 备注: '' },
    { 姓名: '小花', 联系方式: '13800138002', 备注: '周末可接单' },
  ],
  bosses: [
    { 姓名: '张总', 联系方式: '13900139001', 备注: '' },
    { 姓名: '李总', 联系方式: '13900139002', 备注: 'VIP客户' },
  ],
  deposits: [
    {
      老板: '张总',
      充值金额: 500,
      赠送金额: 50,
      总额度: 550,
      剩余余额: 550,
      折扣率: 0.9,
      状态: '正常',
    },
  ],
}

const COMPANION_HEADERS = {
  id: '编号',
  name: '姓名',
  contact: '联系方式',
  remark: '备注',
  createdAt: '创建时间',
}

const BOSS_HEADERS = {
  id: '编号',
  name: '姓名',
  contact: '联系方式',
  remark: '备注',
  createdAt: '创建时间',
}

const DEPOSIT_HEADERS = {
  id: '编号',
  bossName: '老板',
  depositAmount: '充值金额',
  bonusAmount: '赠送金额',
  totalBalance: '总额度',
  remainingBalance: '剩余余额',
  discountRate: '折扣率',
  status: '状态',
  createdAt: '创建时间',
}

// 把数据按中文表头映射，方便 Excel 里看
function mapToHeaders(data, headerMap) {
  return data.map((item) => {
    const row = {}
    for (const [key, label] of Object.entries(headerMap)) {
      if (item[key] !== undefined && item[key] !== null) {
        row[label] = item[key]
      } else {
        row[label] = ''
      }
    }
    return row
  })
}

// 从中文表头还原回英文字段
function mapFromHeaders(data, headerMap) {
  const reversed = {}
  for (const [key, label] of Object.entries(headerMap)) {
    reversed[label] = key
  }
  return data.map((row) => {
    const item = {}
    for (const [label, val] of Object.entries(row)) {
      const key = reversed[label]
      if (key) {
        item[key] = val
      }
    }
    return item
  })
}

function DataSync() {
  const { settings } = useTheme()
  const template = settings.orderTemplate || defaultOrderTemplate

  const [dateRange, setDateRange] = useState(null)
  const [exportLoading, setExportLoading] = useState(false)
  const [importLoading, setImportLoading] = useState(false)
  const [importResult, setImportResult] = useState(null)
  const [previewData, setPreviewData] = useState(null)
  const [exportMode, setExportMode] = useState('range')
  const [templateLoading, setTemplateLoading] = useState(false)

  // 根据系统设置的模板动态生成订单模板表头 { key: label }
  const orderTemplateHeaders = {}
  template.forEach((field) => {
    orderTemplateHeaders[field.key] = field.label
  })

  // 根据模板动态生成示例数据（2行）
  const orderSampleData = [0, 1].map((rowIndex) => {
    const row = {}
    template.forEach((field) => {
      row[field.label] = getSampleValue(field, rowIndex)
    })
    return row
  })

  // ============ 下载模板 ============
  const handleDownloadTemplate = async () => {
    try {
      setTemplateLoading(true)
      const sheets = [
        {
          name: '订单记录',
          data: orderSampleData,
          header: template.map((f) => f.label),
        },
        {
          name: '陪玩',
          data: FIXED_SAMPLE_DATA.companions,
          header: Object.values(COMPANION_TEMPLATE_HEADERS),
        },
        {
          name: '老板',
          data: FIXED_SAMPLE_DATA.bosses,
          header: Object.values(BOSS_TEMPLATE_HEADERS),
        },
        {
          name: '存单',
          data: FIXED_SAMPLE_DATA.deposits,
          header: Object.values(DEPOSIT_TEMPLATE_HEADERS),
        },
      ]
      const result = await window.electronAPI?.saveFile({
        defaultName: '接单数据模板.xlsx',
        sheets,
      })
      if (result?.success) {
        message.success(
          '模板已下载，里面有示例数据，照着格式填就行，填完再来导入',
        )
      } else if (result?.error) {
        message.error(result.error)
      }
    } catch (e) {
      console.error('Template error:', e)
      message.error('下载模板出错了：' + e.message)
    } finally {
      setTemplateLoading(false)
    }
  }

  // 快捷日期
  const quickDates = [
    {
      label: '今天',
      getValue: () => [dayjs().startOf('day'), dayjs().endOf('day')],
    },
    {
      label: '昨天',
      getValue: () => [
        dayjs().subtract(1, 'day').startOf('day'),
        dayjs().subtract(1, 'day').endOf('day'),
      ],
    },
    {
      label: '近3天',
      getValue: () => [
        dayjs().subtract(2, 'day').startOf('day'),
        dayjs().endOf('day'),
      ],
    },
    {
      label: '近7天',
      getValue: () => [
        dayjs().subtract(6, 'day').startOf('day'),
        dayjs().endOf('day'),
      ],
    },
    {
      label: '本月',
      getValue: () => [dayjs().startOf('month'), dayjs().endOf('day')],
    },
  ]

  // ============ 导出 ============
  const handleExport = async () => {
    try {
      setExportLoading(true)

      const allOrders = await getAll(DATA_FILES.ORDERS)
      const allCompanions = await getAll(DATA_FILES.COMPANIONS)
      const allBosses = await getAll(DATA_FILES.BOSSES)
      const allDeposits = await getAll(DATA_FILES.DEPOSITS)

      let exportOrders = allOrders

      if (exportMode === 'range' && dateRange) {
        const [start, end] = dateRange
        exportOrders = allOrders.filter((o) => {
          const d = dayjs(o.date || o.createdAt)
          return (
            d.isValid() && d >= start.startOf('day') && d <= end.endOf('day')
          )
        })
      }

      if (exportOrders.length === 0) {
        message.warning('这个时间段里没有订单哦')
        return
      }

      // 收集关联数据
      const companionNames = new Set(
        exportOrders.map((o) => o.companionName).filter(Boolean),
      )
      const companionIds = new Set(
        exportOrders.map((o) => o.companionId).filter(Boolean),
      )
      const bossNames = new Set(
        exportOrders.map((o) => o.bossName).filter(Boolean),
      )
      const bossIds = new Set(exportOrders.map((o) => o.bossId).filter(Boolean))
      const depositIds = new Set(
        exportOrders.map((o) => o.depositId).filter(Boolean),
      )

      const exportCompanions = allCompanions.filter(
        (c) => companionNames.has(c.name) || companionIds.has(c.id),
      )
      const exportBosses = allBosses.filter(
        (b) => bossNames.has(b.name) || bossIds.has(b.id),
      )
      const exportBossNames = new Set(exportBosses.map((b) => b.name))
      const exportDeposits = allDeposits.filter(
        (d) => depositIds.has(d.id) || exportBossNames.has(d.bossName),
      )

      // 构建 Excel 多 sheet 数据
      const sheets = [
        {
          name: '订单记录',
          data: mapToHeaders(exportOrders, ORDER_HEADERS),
          header: Object.values(ORDER_HEADERS),
        },
        {
          name: '陪玩',
          data: mapToHeaders(exportCompanions, COMPANION_HEADERS),
          header: Object.values(COMPANION_HEADERS),
        },
        {
          name: '老板',
          data: mapToHeaders(exportBosses, BOSS_HEADERS),
          header: Object.values(BOSS_HEADERS),
        },
        {
          name: '存单',
          data: mapToHeaders(exportDeposits, DEPOSIT_HEADERS),
          header: Object.values(DEPOSIT_HEADERS),
        },
      ]

      const rangeStr = dateRange
        ? `${dateRange[0].format('MM月DD日')}-${dateRange[1].format('MM月DD日')}`
        : exportMode === 'all'
          ? '全部'
          : dayjs().format('MM月DD日')
      const defaultName = `接单数据_${rangeStr}.xlsx`

      const result = await window.electronAPI?.saveFile({ defaultName, sheets })

      if (result?.success) {
        message.success(
          `导出成功啦！一共 ${exportOrders.length} 条订单，${exportCompanions.length} 个陪玩，${exportBosses.length} 个老板，${exportDeposits.length} 张存单`,
        )
      }
    } catch (e) {
      console.error('Export error:', e)
      message.error('导出出错了：' + e.message)
    } finally {
      setExportLoading(false)
    }
  }

  // ============ 导入 ============
  const handleImport = async () => {
    try {
      setImportLoading(true)
      setImportResult(null)
      setPreviewData(null)

      const result = await window.electronAPI?.openFile()
      if (!result?.success) {
        if (result?.error) message.error(result.error)
        return
      }

      const { sheets } = result

      // 从 Excel 各 sheet 还原数据（兼容完整导出格式和模板格式）
      // 合并完整表头 + 动态模板表头，这样自定义字段也能识别
      const mergedOrderHeaders = { ...ORDER_HEADERS, ...orderTemplateHeaders }
      const orders = mapFromHeaders(
        sheets['订单记录'] || [],
        mergedOrderHeaders,
      )
      const companions = mapFromHeaders(sheets['陪玩'] || [], COMPANION_HEADERS)
      const bosses = mapFromHeaders(sheets['老板'] || [], BOSS_HEADERS)
      const deposits = mapFromHeaders(sheets['存单'] || [], DEPOSIT_HEADERS)

      if (orders.length === 0) {
        message.warning('这个文件里没找到订单数据，确认选对文件了吗？')
        return
      }

      const now = dayjs().format('YYYY-MM-DD HH:mm:ss')

      // 根据模板获取所有 number 类型的字段 key
      const numberFieldKeys = new Set(
        template.filter((f) => f.type === 'number').map((f) => f.key),
      )

      // 为没有 id 的记录自动生成（来自模板的数据不会有 id）
      // 同时过滤掉完全空的行，number 类型字段自动转数字
      const validOrders = orders
        .filter((o) => o.date || o.bossName || o.companionName)
        .map((o) => {
          const row = {
            ...o,
            id: o.id || uuidv4(),
            createdAt: o.createdAt || now,
          }
          // 把所有 number 类型字段转成数字
          numberFieldKeys.forEach((key) => {
            if (row[key] !== undefined && row[key] !== '') {
              row[key] = Number(row[key])
            }
          })
          return row
        })
      const validCompanions = companions
        .filter((c) => c.name)
        .map((c) => ({
          ...c,
          id: c.id || uuidv4(),
          createdAt: c.createdAt || now,
        }))
      const validBosses = bosses
        .filter((b) => b.name)
        .map((b) => ({
          ...b,
          id: b.id || uuidv4(),
          createdAt: b.createdAt || now,
        }))
      const validDeposits = deposits
        .filter((d) => d.bossName)
        .map((d) => ({
          ...d,
          id: d.id || uuidv4(),
          createdAt: d.createdAt || now,
          depositAmount:
            d.depositAmount !== undefined ? Number(d.depositAmount) : undefined,
          bonusAmount:
            d.bonusAmount !== undefined ? Number(d.bonusAmount) : undefined,
          totalBalance:
            d.totalBalance !== undefined ? Number(d.totalBalance) : undefined,
          remainingBalance:
            d.remainingBalance !== undefined
              ? Number(d.remainingBalance)
              : undefined,
          discountRate:
            d.discountRate !== undefined ? Number(d.discountRate) : undefined,
        }))

      // 读取本地数据做去重
      const currentOrders = await getAll(DATA_FILES.ORDERS)
      const currentCompanions = await getAll(DATA_FILES.COMPANIONS)
      const currentBosses = await getAll(DATA_FILES.BOSSES)
      const currentDeposits = await getAll(DATA_FILES.DEPOSITS)

      const existingOrderIds = new Set(currentOrders.map((o) => o.id))
      const existingCompanionIds = new Set(currentCompanions.map((c) => c.id))
      const existingBossIds = new Set(currentBosses.map((b) => b.id))
      const existingDepositIds = new Set(currentDeposits.map((d) => d.id))

      const existingCompanionNames = new Set(
        currentCompanions.map((c) => c.name?.toLowerCase()),
      )
      const existingBossNames = new Set(
        currentBosses.map((b) => b.name?.toLowerCase()),
      )

      const newOrders = validOrders.filter((o) => !existingOrderIds.has(o.id))
      const newCompanions = validCompanions.filter(
        (c) =>
          !existingCompanionIds.has(c.id) &&
          !existingCompanionNames.has(c.name?.toLowerCase()),
      )
      const newBosses = validBosses.filter(
        (b) =>
          !existingBossIds.has(b.id) &&
          !existingBossNames.has(b.name?.toLowerCase()),
      )
      const newDeposits = validDeposits.filter(
        (d) => !existingDepositIds.has(d.id),
      )

      const stats = {
        orders: {
          total: validOrders.length,
          new: newOrders.length,
          skip: validOrders.length - newOrders.length,
        },
        companions: {
          total: validCompanions.length,
          new: newCompanions.length,
          skip: validCompanions.length - newCompanions.length,
        },
        bosses: {
          total: validBosses.length,
          new: newBosses.length,
          skip: validBosses.length - newBosses.length,
        },
        deposits: {
          total: validDeposits.length,
          new: newDeposits.length,
          skip: validDeposits.length - newDeposits.length,
        },
      }

      setPreviewData({
        stats,
        newOrders,
        newCompanions,
        newBosses,
        newDeposits,
        currentOrders,
        currentCompanions,
        currentBosses,
        currentDeposits,
        filePath: result.filePath,
      })
    } catch (e) {
      console.error('Import error:', e)
      message.error('导入出错了：' + e.message)
    } finally {
      setImportLoading(false)
    }
  }

  // 确认合并
  const handleConfirmMerge = async () => {
    if (!previewData) return
    try {
      setImportLoading(true)
      const {
        stats,
        newOrders,
        newCompanions,
        newBosses,
        newDeposits,
        currentOrders,
        currentCompanions,
        currentBosses,
        currentDeposits,
      } = previewData

      if (newCompanions.length > 0) {
        await writeData(DATA_FILES.COMPANIONS, [
          ...currentCompanions,
          ...newCompanions,
        ])
      }
      if (newBosses.length > 0) {
        await writeData(DATA_FILES.BOSSES, [...currentBosses, ...newBosses])
      }
      if (newDeposits.length > 0) {
        await writeData(DATA_FILES.DEPOSITS, [
          ...currentDeposits,
          ...newDeposits,
        ])
      }
      if (newOrders.length > 0) {
        await writeData(DATA_FILES.ORDERS, [...currentOrders, ...newOrders])
      }

      setImportResult(stats)
      setPreviewData(null)
      message.success('数据已经合并好啦！')
    } catch (e) {
      console.error('Merge error:', e)
      message.error('合并出错了：' + e.message)
    } finally {
      setImportLoading(false)
    }
  }

  const previewColumns = [
    { title: '类型', dataIndex: 'type', width: 100 },
    { title: '文件里有', dataIndex: 'total', width: 100, align: 'center' },
    {
      title: '要新加的',
      dataIndex: 'new',
      width: 100,
      align: 'center',
      render: (v) => (
        <span style={{ color: 'var(--color-success)', fontWeight: 'bold' }}>
          {v}
        </span>
      ),
    },
    {
      title: '已经有了',
      dataIndex: 'skip',
      width: 100,
      align: 'center',
      render: (v) =>
        v > 0 ? (
          <span style={{ color: 'var(--color-text-tertiary)' }}>{v}</span>
        ) : (
          0
        ),
    },
  ]

  const getPreviewDataSource = (stats) => {
    if (!stats) return []
    return [
      { key: 'orders', type: '订单', ...stats.orders },
      { key: 'companions', type: '陪玩', ...stats.companions },
      { key: 'bosses', type: '老板', ...stats.bosses },
      { key: 'deposits', type: '存单', ...stats.deposits },
    ]
  }

  return (
    <div>
      <Row gutter={16}>
        {/* 左侧：导出 */}
        <Col span={12}>
          <Card
            title={
              <Space>
                <FileExcelOutlined />
                <span>导出表格</span>
                <Tag color="blue">管理员用</Tag>
              </Space>
            }
            size="small"
          >
            <Alert
              type="info"
              showIcon
              icon={<InfoCircleOutlined />}
              message="管理员把自己的接单数据导出成Excel表格，然后发给店长就行了。"
              style={{ marginBottom: 16 }}
            />

            <div style={{ marginBottom: 16 }}>
              <Text strong style={{ display: 'block', marginBottom: 8 }}>
                选择要导出哪些天的数据
              </Text>
              <Radio.Group
                value={exportMode}
                onChange={(e) => {
                  setExportMode(e.target.value)
                  if (e.target.value === 'all') setDateRange(null)
                }}
                style={{ marginBottom: 12 }}
              >
                <Radio.Button value="range">选日期</Radio.Button>
                <Radio.Button value="all">全部导出</Radio.Button>
              </Radio.Group>

              {exportMode === 'range' && (
                <>
                  <div style={{ marginBottom: 8 }}>
                    <Space wrap>
                      {quickDates.map((q) => (
                        <Button
                          key={q.label}
                          size="small"
                          type={
                            dateRange &&
                            dateRange[0].format('YYYY-MM-DD') ===
                              q.getValue()[0].format('YYYY-MM-DD') &&
                            dateRange[1].format('YYYY-MM-DD') ===
                              q.getValue()[1].format('YYYY-MM-DD')
                              ? 'primary'
                              : 'default'
                          }
                          onClick={() => setDateRange(q.getValue())}
                        >
                          {q.label}
                        </Button>
                      ))}
                    </Space>
                  </div>
                  <RangePicker
                    value={dateRange}
                    onChange={setDateRange}
                    style={{ width: '100%' }}
                    placeholder={['开始日期', '结束日期']}
                  />
                </>
              )}
            </div>

            <Button
              type="primary"
              icon={<ExportOutlined />}
              loading={exportLoading}
              onClick={handleExport}
              disabled={exportMode === 'range' && !dateRange}
              block
              size="large"
            >
              导出Excel表格
            </Button>

            <Divider />
            <Text type="secondary" style={{ fontSize: 12 }}>
              <FileExcelOutlined />{' '}
              导出的Excel文件里包含：订单记录、陪玩信息、老板信息、存单信息，
              用Excel或WPS都能打开看。发给店长后，店长在右边点"导入"就能合并数据，
              就算重复导入也不会有重复的记录。
            </Text>
          </Card>
        </Col>

        {/* 右侧：导入 */}
        <Col span={12}>
          <Card
            title={
              <Space>
                <FileExcelOutlined />
                <span>导入表格</span>
                <Tag color="green">店长用</Tag>
              </Space>
            }
            size="small"
          >
            <Alert
              type="info"
              showIcon
              icon={<InfoCircleOutlined />}
              message="第一次用？先下载模板，按格式填好数据，再点导入就能批量录入啦。管理员发来的表格也可以直接导入。"
              style={{ marginBottom: 16 }}
            />

            <Space direction="vertical" style={{ width: '100%' }}>
              <Button
                icon={<DownloadOutlined />}
                loading={templateLoading}
                onClick={handleDownloadTemplate}
                block
                size="large"
              >
                下载Excel模板
              </Button>
              <Button
                icon={<ImportOutlined />}
                loading={importLoading}
                onClick={handleImport}
                block
                size="large"
                type={previewData ? 'default' : 'primary'}
              >
                选择Excel文件导入
              </Button>
            </Space>

            {/* 预览 */}
            {previewData && (
              <div style={{ marginTop: 16 }}>
                <Alert
                  type="warning"
                  message={<span>已读取文件，下面是数据对比：</span>}
                  style={{ marginBottom: 12 }}
                />
                <Table
                  columns={previewColumns}
                  dataSource={getPreviewDataSource(previewData.stats)}
                  pagination={false}
                  size="small"
                  bordered
                />
                <Button
                  type="primary"
                  icon={<CheckCircleOutlined />}
                  onClick={handleConfirmMerge}
                  loading={importLoading}
                  block
                  size="large"
                  style={{ marginTop: 12 }}
                >
                  确认导入
                </Button>
                <Button
                  onClick={() => setPreviewData(null)}
                  block
                  style={{ marginTop: 8 }}
                >
                  取消
                </Button>
              </div>
            )}

            {/* 结果 */}
            {importResult && !previewData && (
              <div style={{ marginTop: 16 }}>
                <Alert
                  type="success"
                  showIcon
                  icon={<CheckCircleOutlined />}
                  message="导入完成啦"
                  description={
                    <div>
                      <p>
                        新增了 <strong>{importResult.orders.new}</strong> 条订单
                        {importResult.orders.skip > 0 &&
                          `（${importResult.orders.skip} 条之前已经有了）`}
                      </p>
                      <p>
                        新增了 <strong>{importResult.companions.new}</strong>{' '}
                        个陪玩
                        {importResult.companions.skip > 0 &&
                          `（${importResult.companions.skip} 个之前已经有了）`}
                      </p>
                      <p>
                        新增了 <strong>{importResult.bosses.new}</strong> 个老板
                        {importResult.bosses.skip > 0 &&
                          `（${importResult.bosses.skip} 个之前已经有了）`}
                      </p>
                      <p>
                        新增了 <strong>{importResult.deposits.new}</strong>{' '}
                        张存单
                        {importResult.deposits.skip > 0 &&
                          `（${importResult.deposits.skip} 张之前已经有了）`}
                      </p>
                    </div>
                  }
                />
              </div>
            )}

            <Divider />
            <Text type="secondary" style={{ fontSize: 12 }}>
              <FileExcelOutlined />{' '}
              第一次使用可以先下载模板，把已有的订单数据按格式填进去再导入，省得一条条手动录。
              管理员发来的表格也能直接导入，已经有的数据不会重复。
            </Text>
          </Card>
        </Col>
      </Row>
    </div>
  )
}

export default DataSync
