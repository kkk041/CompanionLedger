import React, { useState, useEffect, useMemo } from 'react'
import {
  Table,
  Card,
  DatePicker,
  Space,
  Tag,
  Input,
  Row,
  Col,
  Button,
  Descriptions,
  Modal,
  Popconfirm,
  message,
  Form,
  InputNumber,
  Switch,
  Tooltip,
  Statistic,
} from 'antd'
import {
  SearchOutlined,
  EyeOutlined,
  DeleteOutlined,
  EditOutlined,
  FilterOutlined,
  ClockCircleOutlined,
  FundOutlined,
  TrophyOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import { v4 as uuidv4 } from 'uuid'
import {
  getAll,
  deleteRecord,
  updateRecord,
  addRecord,
  DATA_FILES,
} from '../services/storage'
import { fmtMoney, calcStoreProfit } from '../utils/format'
import { useTheme } from '../contexts/ThemeContext'
import { defaultOrderTemplate } from '../utils/templateParser'

const { RangePicker } = DatePicker

function HistoryRecords() {
  const { settings } = useTheme()
  const template = settings.orderTemplate || defaultOrderTemplate

  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(false)
  const [dateRange, setDateRange] = useState(null)
  const [searchText, setSearchText] = useState('')
  const [detailVisible, setDetailVisible] = useState(false)
  const [detailRecord, setDetailRecord] = useState(null)
  const [selectedRowKeys, setSelectedRowKeys] = useState([])
  const [editVisible, setEditVisible] = useState(false)
  const [editingOrder, setEditingOrder] = useState(null)
  const [form] = Form.useForm()

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    const ordersData = await getAll(DATA_FILES.ORDERS)
    setOrders(ordersData)
    setLoading(false)
  }

  const filteredOrders = useMemo(() => {
    let result = [...orders]

    // 日期过滤
    if (dateRange && dateRange[0] && dateRange[1]) {
      const start = dateRange[0].startOf('day')
      const end = dateRange[1].endOf('day')
      result = result.filter((o) => {
        const dateStr = o.date || o.orderTime
        if (!dateStr) return false
        const t = dayjs(dateStr)
        return t.isAfter(start) && t.isBefore(end)
      })
    }

    // 搜索（匹配所有文本字段）
    if (searchText) {
      const lower = searchText.toLowerCase()
      result = result.filter((o) => {
        return template.some((field) => {
          if (field.type === 'flag' || field.type === 'number') return false
          const val = o[field.key]
          return val && String(val).toLowerCase().includes(lower)
        })
      })
    }

    // 按日期倒序
    result.sort((a, b) => {
      const da = dayjs(a.date || a.orderTime || 0)
      const db = dayjs(b.date || b.orderTime || 0)
      return db.unix() - da.unix()
    })

    return result
  }, [orders, dateRange, searchText, template])

  const filteredStats = useMemo(() => {
    const total = filteredOrders.length
    const totalAmount = filteredOrders.reduce(
      (sum, o) => sum + (parseFloat(o.totalAmount) || 0),
      0,
    )
    const totalDuration = filteredOrders.reduce(
      (sum, o) => sum + (parseFloat(o.duration) || 0),
      0,
    )
    const totalProfit = filteredOrders.reduce(
      (sum, o) => sum + calcStoreProfit(o),
      0,
    )
    return { total, totalAmount, totalDuration, totalProfit }
  }, [filteredOrders])

  const showDetail = (record) => {
    setDetailRecord(record)
    setDetailVisible(true)
  }

  const resetFilters = () => {
    setDateRange(null)
    setSearchText('')
  }

  // 删除单条记录
  const handleDelete = async (id) => {
    await deleteRecord(DATA_FILES.ORDERS, id)
    message.success('删除成功')
    setSelectedRowKeys((prev) => prev.filter((k) => k !== id))
    loadData()
  }

  // 批量删除
  const handleBatchDelete = async () => {
    for (const id of selectedRowKeys) {
      await deleteRecord(DATA_FILES.ORDERS, id)
    }
    message.success(`已删除 ${selectedRowKeys.length} 条记录`)
    setSelectedRowKeys([])
    loadData()
  }

  // 编辑订单
  const handleEdit = (record) => {
    setEditingOrder(record)
    setEditVisible(true)
  }

  const handleEditSubmit = async () => {
    const values = form.getFieldsValue()
    const orderData = { ...values }

    // 同步陪玩名称变更
    if (
      editingOrder.companionName !== orderData.companionName &&
      orderData.companionName
    ) {
      const companions = await getAll(DATA_FILES.COMPANIONS)
      const existing = companions.find((c) => c.id === editingOrder.companionId)
      if (existing) {
        await updateRecord(DATA_FILES.COMPANIONS, existing.id, {
          name: orderData.companionName,
        })
      } else {
        const comp = companions.find((c) => c.name === orderData.companionName)
        if (comp) {
          orderData.companionId = comp.id
        } else {
          const newComp = {
            id: uuidv4(),
            name: orderData.companionName,
            contact: '',
            remark: '由订单编辑创建',
            createdAt: dayjs().format('YYYY-MM-DD HH:mm:ss'),
          }
          await addRecord(DATA_FILES.COMPANIONS, newComp)
          orderData.companionId = newComp.id
        }
      }
    }

    // 同步老板名称变更
    if (editingOrder.bossName !== orderData.bossName && orderData.bossName) {
      const bosses = await getAll(DATA_FILES.BOSSES)
      const existing = bosses.find((b) => b.id === editingOrder.bossId)
      if (existing) {
        await updateRecord(DATA_FILES.BOSSES, existing.id, {
          name: orderData.bossName,
        })
      } else {
        const boss = bosses.find((b) => b.name === orderData.bossName)
        if (boss) {
          orderData.bossId = boss.id
        } else {
          const newBoss = {
            id: uuidv4(),
            name: orderData.bossName,
            contact: '',
            remark: '由订单编辑创建',
            createdAt: dayjs().format('YYYY-MM-DD HH:mm:ss'),
          }
          await addRecord(DATA_FILES.BOSSES, newBoss)
          orderData.bossId = newBoss.id
        }
      }
    }

    await updateRecord(DATA_FILES.ORDERS, editingOrder.id, orderData)
    message.success('更新成功')
    setEditVisible(false)
    loadData()
  }

  const renderFormField = (field) => {
    if (field.type === 'flag') return <Switch />
    if (field.type === 'number')
      return <InputNumber style={{ width: '100%' }} />
    return <Input />
  }

  // 固定表格列顺序
  const columns = [
    {
      title: '陪玩',
      dataIndex: 'companionName',
      key: 'companionName',
      ellipsis: true,
      render: (text) => (text ? <Tag color="blue">{text}</Tag> : '-'),
    },
    {
      title: '老板',
      dataIndex: 'bossName',
      key: 'bossName',
      ellipsis: true,
      render: (text) => (text ? <Tag color="green">{text}</Tag> : '-'),
    },
    {
      title: '管理',
      dataIndex: 'manager',
      key: 'manager',
      ellipsis: true,
      render: (text) => (text ? <Tag color="orange">{text}</Tag> : '-'),
    },
    {
      title: '类型',
      dataIndex: 'orderType',
      key: 'orderType',
      ellipsis: true,
      render: (text) => text || '-',
    },
    {
      title: '单价',
      dataIndex: 'unitPrice',
      key: 'unitPrice',
      align: 'right',
      sorter: (a, b) =>
        (parseFloat(a.unitPrice) || 0) - (parseFloat(b.unitPrice) || 0),
      render: (v) => (v != null ? `¥${v}` : '-'),
    },
    {
      title: '时长',
      dataIndex: 'duration',
      key: 'duration',
      align: 'center',
      sorter: (a, b) =>
        (parseFloat(a.duration) || 0) - (parseFloat(b.duration) || 0),
      render: (v) =>
        v != null ? `${String(v).replace(/[hH小时]+$/g, '')}H` : '-',
    },
    {
      title: '总计',
      dataIndex: 'totalAmount',
      key: 'totalAmount',
      align: 'right',
      sorter: (a, b) =>
        (parseFloat(a.totalAmount) || 0) - (parseFloat(b.totalAmount) || 0),
      render: (v) =>
        v != null ? <span style={{ fontWeight: 'bold' }}>¥{v}</span> : '-',
    },
    {
      title: '抽成',
      dataIndex: 'commissionAmount',
      key: 'commissionAmount',
      align: 'right',
      sorter: (a, b) =>
        (parseFloat(a.commissionAmount) || 0) -
        (parseFloat(b.commissionAmount) || 0),
      render: (v) =>
        v != null ? (
          <span style={{ color: 'var(--color-danger)' }}>¥{v}</span>
        ) : (
          '-'
        ),
    },
    {
      title: '到手',
      dataIndex: 'actualIncome',
      key: 'actualIncome',
      align: 'right',
      sorter: (a, b) =>
        (parseFloat(a.actualIncome) || 0) - (parseFloat(b.actualIncome) || 0),
      render: (v) =>
        v != null ? (
          <span style={{ color: 'var(--color-success)', fontWeight: 'bold' }}>
            ¥{v}
          </span>
        ) : (
          '-'
        ),
    },
    {
      title: '存单',
      key: 'deposit',
      align: 'center',
      width: 70,
      render: (_, record) => {
        if (!record.depositId) return null
        const rate = record.depositDiscount
        if (rate && rate < 100) {
          return <Tag color="volcano">{rate / 10}折</Tag>
        }
        return <Tag color="cyan">存单</Tag>
      },
    },
    {
      title: '操作',
      key: 'action',
      width: 110,
      render: (_, record) => (
        <Space>
          <Tooltip title="查看详情">
            <Button
              type="link"
              size="small"
              icon={<EyeOutlined />}
              onClick={() => showDetail(record)}
            />
          </Tooltip>
          <Tooltip title="编辑">
            <Button
              type="link"
              size="small"
              icon={<EditOutlined />}
              onClick={() => handleEdit(record)}
            />
          </Tooltip>
          <Popconfirm
            title="确定删除此记录？"
            onConfirm={() => handleDelete(record.id)}
          >
            <Tooltip title="删除">
              <Button
                type="link"
                size="small"
                danger
                icon={<DeleteOutlined />}
              />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  // 详情弹窗中根据模板动态显示字段
  const renderDetailValue = (field, record) => {
    const val = record[field.key]
    if (field.type === 'flag') return val ? '是' : '否'
    if (field.type === 'number') {
      if (
        [
          'unitPrice',
          'totalAmount',
          'commissionAmount',
          'actualIncome',
        ].includes(field.key)
      )
        return val != null ? `¥${val}` : '-'
      return val != null ? val : '-'
    }
    return val || '-'
  }

  return (
    <div>
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="筛选结果"
              value={filteredStats.total}
              suffix="条"
              prefix={<FilterOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="总时长"
              value={Number(filteredStats.totalDuration || 0).toFixed(1)}
              suffix="H"
              prefix={<ClockCircleOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="流水金额"
              value={filteredStats.totalAmount}
              formatter={(v) => fmtMoney(v)}
              prefix={
                <>
                  <FundOutlined /> ¥
                </>
              }
              valueStyle={{ color: 'var(--color-info)' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="盈利"
              value={filteredStats.totalProfit}
              formatter={(v) => fmtMoney(v)}
              prefix={
                <>
                  <TrophyOutlined /> ¥
                </>
              }
              valueStyle={{ color: 'var(--color-success)' }}
            />
          </Card>
        </Col>
      </Row>

      <Card
        title="历史接单记录"
        size="small"
        extra={
          <Space>
            <RangePicker
              value={dateRange}
              onChange={setDateRange}
              allowClear
              placeholder={['开始', '结束']}
              size="small"
            />
            <Input
              placeholder="搜索陪玩/老板/管理/类型..."
              prefix={<SearchOutlined />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              allowClear
              style={{ width: 200 }}
              size="small"
            />
            <Button size="small" onClick={resetFilters}>
              重置
            </Button>
            {selectedRowKeys.length > 0 && (
              <Popconfirm
                title={`确定删除选中的 ${selectedRowKeys.length} 条记录？`}
                onConfirm={handleBatchDelete}
              >
                <Button danger size="small" icon={<DeleteOutlined />}>
                  批量删除({selectedRowKeys.length})
                </Button>
              </Popconfirm>
            )}
          </Space>
        }
      >
        <Table
          columns={columns}
          dataSource={filteredOrders}
          rowKey="id"
          loading={loading}
          rowSelection={{
            selectedRowKeys,
            onChange: setSelectedRowKeys,
          }}
          pagination={{
            pageSize: settings.pageSize || 15,
            showTotal: (total) => `共 ${total} 条`,
          }}
          size="small"
        />
      </Card>

      <Modal
        title="接单详情"
        open={detailVisible}
        onCancel={() => setDetailVisible(false)}
        footer={null}
        width={550}
      >
        {detailRecord && (
          <Descriptions
            column={2}
            bordered
            size="small"
            style={{ marginTop: 16 }}
          >
            {template.map((field) => (
              <Descriptions.Item key={field.key} label={field.label}>
                {renderDetailValue(field, detailRecord)}
              </Descriptions.Item>
            ))}
            <Descriptions.Item label="创建时间" span={2}>
              {detailRecord.createdAt || '-'}
            </Descriptions.Item>
            {detailRecord.depositId && (
              <>
                <Descriptions.Item label="存单扣款">
                  <span style={{ color: 'var(--color-danger)' }}>
                    ¥{fmtMoney(detailRecord.depositDeduction)}
                  </span>
                </Descriptions.Item>
                <Descriptions.Item label="存单折扣">
                  {detailRecord.depositDiscount &&
                  detailRecord.depositDiscount < 100 ? (
                    <Tag color="volcano">
                      {detailRecord.depositDiscount / 10}折
                    </Tag>
                  ) : (
                    '无折扣'
                  )}
                </Descriptions.Item>
                {detailRecord.depositDiscount &&
                  detailRecord.depositDiscount < 100 && (
                    <Descriptions.Item label="折扣影响" span={2}>
                      <span style={{ color: 'var(--color-warning)' }}>
                        折扣差额 ¥
                        {fmtMoney(
                          Math.round(
                            (parseFloat(detailRecord.totalAmount) || 0) *
                              (100 - detailRecord.depositDiscount),
                          ) / 100,
                        )}
                        ，由店铺承担
                      </span>
                      {' → '}
                      <span
                        style={{
                          color: 'var(--color-success)',
                          fontWeight: 'bold',
                        }}
                      >
                        实际盈利 ¥{fmtMoney(calcStoreProfit(detailRecord))}
                      </span>
                    </Descriptions.Item>
                  )}
              </>
            )}
          </Descriptions>
        )}
      </Modal>

      {/* 编辑弹窗 */}
      <Modal
        title="编辑接单记录"
        open={editVisible}
        onOk={handleEditSubmit}
        onCancel={() => setEditVisible(false)}
        width={650}
        destroyOnHidden
        afterOpenChange={(open) => {
          if (open && editingOrder) {
            form.setFieldsValue(editingOrder)
          }
        }}
      >
        <Form
          form={form}
          layout="vertical"
          size="small"
          style={{ marginTop: 16 }}
        >
          <Row gutter={[8, 0]}>
            {template.map((field) => (
              <Col span={field.type === 'flag' ? 8 : 12} key={field.key}>
                <Form.Item
                  name={field.key}
                  label={field.label}
                  valuePropName={field.type === 'flag' ? 'checked' : 'value'}
                  style={{ marginBottom: 8 }}
                >
                  {renderFormField(field)}
                </Form.Item>
              </Col>
            ))}
          </Row>
        </Form>
      </Modal>
    </div>
  )
}

export default HistoryRecords
