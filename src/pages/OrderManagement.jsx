import React, { useState, useEffect } from 'react'
import {
  Table,
  Button,
  Modal,
  Form,
  Input,
  InputNumber,
  Space,
  Popconfirm,
  message,
  Card,
  Row,
  Col,
  Statistic,
  Tag,
  Switch,
  Descriptions,
  Tooltip,
} from 'antd'
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ImportOutlined,
  SettingOutlined,
  EyeOutlined,
  FileTextOutlined,
  ThunderboltOutlined,
  FundOutlined,
  TrophyOutlined,
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'
import { v4 as uuidv4 } from 'uuid'
import {
  getAll,
  addRecord,
  updateRecord,
  deleteRecord,
  DATA_FILES,
} from '../services/storage'
import { fmtMoney, calcStoreProfit } from '../utils/format'
import { useTheme } from '../contexts/ThemeContext'
import {
  parseTemplateText,
  defaultOrderTemplate,
} from '../utils/templateParser'

function OrderManagement() {
  const navigate = useNavigate()
  const { settings } = useTheme()
  const template = settings.orderTemplate || defaultOrderTemplate

  const [orders, setOrders] = useState([])
  const [deposits, setDeposits] = useState([])
  const [loading, setLoading] = useState(false)
  const [modalVisible, setModalVisible] = useState(false)
  const [importModalVisible, setImportModalVisible] = useState(false)
  const [editingOrder, setEditingOrder] = useState(null)
  const [importText, setImportText] = useState('')
  const [parsedData, setParsedData] = useState(null)
  const [form] = Form.useForm()
  const [importForm] = Form.useForm()
  const [detailVisible, setDetailVisible] = useState(false)
  const [detailRecord, setDetailRecord] = useState(null)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    const [ordersData, depositsData] = await Promise.all([
      getAll(DATA_FILES.ORDERS),
      getAll(DATA_FILES.DEPOSITS),
    ])
    setOrders(ordersData)
    setDeposits(depositsData)
    setLoading(false)
  }

  // 模糊匹配老板名（忽略大小写、首尾空格）
  const fuzzyMatchBoss = (bosses, name) => {
    const lower = name.toLowerCase()
    return bosses.find((b) => b.name.trim().toLowerCase() === lower)
  }

  // 自动同步老板和陪玩到管理列表
  const syncBossAndCompanion = async (orderData, oldOrder = null) => {
    const bossName = (orderData.bossName || '').trim()
    const companionName = (orderData.companionName || '').trim()

    if (bossName) {
      const bosses = await getAll(DATA_FILES.BOSSES)
      // 编辑时如果名字变了，更新原老板记录
      if (oldOrder && oldOrder.bossId && oldOrder.bossName !== bossName) {
        const oldBoss = bosses.find((b) => b.id === oldOrder.bossId)
        if (oldBoss) {
          await updateRecord(DATA_FILES.BOSSES, oldBoss.id, { name: bossName })
          orderData.bossId = oldBoss.id
        }
      } else {
        const existing = fuzzyMatchBoss(bosses, bossName)
        if (existing) {
          orderData.bossId = existing.id
          // 统一使用已有老板的名字
          orderData.bossName = existing.name
        } else {
          const newBoss = {
            id: uuidv4(),
            name: bossName,
            contact: '',
            remark: '由订单自动创建',
            createdAt: dayjs().format('YYYY-MM-DD HH:mm:ss'),
          }
          await addRecord(DATA_FILES.BOSSES, newBoss)
          orderData.bossId = newBoss.id
        }
      }
    }

    if (companionName) {
      const companions = await getAll(DATA_FILES.COMPANIONS)
      // 编辑时如果名字变了，更新原陪玩记录
      if (
        oldOrder &&
        oldOrder.companionId &&
        oldOrder.companionName !== companionName
      ) {
        const oldComp = companions.find((c) => c.id === oldOrder.companionId)
        if (oldComp) {
          await updateRecord(DATA_FILES.COMPANIONS, oldComp.id, {
            name: companionName,
          })
          orderData.companionId = oldComp.id
        }
      } else {
        const existing = companions.find((c) => c.name.trim() === companionName)
        if (existing) {
          orderData.companionId = existing.id
        } else {
          const newCompanion = {
            id: uuidv4(),
            name: companionName,
            contact: '',
            remark: '由订单自动创建',
            createdAt: dayjs().format('YYYY-MM-DD HH:mm:ss'),
          }
          await addRecord(DATA_FILES.COMPANIONS, newCompanion)
          orderData.companionId = newCompanion.id
        }
      }
    }

    return orderData
  }

  // 手动新增
  const handleAdd = () => {
    setEditingOrder(null)
    form.resetFields()
    form.setFieldsValue({ date: dayjs().format('YYYY-MM-DD') })
    setModalVisible(true)
  }

  // 编辑
  const handleEdit = (record) => {
    setEditingOrder(record)
    setModalVisible(true)
  }

  // 删除
  const handleDelete = async (id) => {
    await deleteRecord(DATA_FILES.ORDERS, id)
    message.success('删除成功')
    loadData()
  }

  // 存单扣款：查找老板的生效存单，按折扣扣款并自动调整到手金额
  const deductFromDeposit = async (orderData) => {
    const bossName = (orderData.bossName || '').trim()
    if (!bossName) return orderData

    const deposits = await getAll(DATA_FILES.DEPOSITS)
    // 找到该老板的生效存单（余额 > 0，模糊匹配名字）
    const lowerBoss = bossName.toLowerCase()
    const activeDeposit = deposits.find(
      (d) =>
        d.bossName.trim().toLowerCase() === lowerBoss &&
        d.status === 'active' &&
        (parseFloat(d.remainingBalance) || 0) > 0,
    )

    if (!activeDeposit) return orderData

    const totalAmount = parseFloat(orderData.totalAmount) || 0
    if (totalAmount <= 0) return orderData

    // 计算折后价
    const discountRate = (activeDeposit.discountRate || 100) / 100
    const deduction = Math.round(totalAmount * discountRate * 100) / 100
    const remaining = parseFloat(activeDeposit.remainingBalance) || 0
    const actualDeduction = Math.min(deduction, remaining)
    const newRemaining = Math.round((remaining - actualDeduction) * 100) / 100

    // 更新存单余额
    const updateData = { remainingBalance: newRemaining }
    if (newRemaining <= 0) updateData.status = 'exhausted'
    await updateRecord(DATA_FILES.DEPOSITS, activeDeposit.id, updateData)

    // 在订单上记录存单扣款信息
    orderData.depositId = activeDeposit.id
    orderData.depositDeduction = actualDeduction
    orderData.depositDiscount = activeDeposit.discountRate

    return orderData
  }

  // 保存手动新增/编辑
  const handleSubmit = async () => {
    const values = await form.validateFields()
    let orderData = { ...values }

    // 自动同步老板和陪玩
    orderData = await syncBossAndCompanion(orderData, editingOrder)

    if (editingOrder) {
      await updateRecord(DATA_FILES.ORDERS, editingOrder.id, orderData)
      message.success('更新成功')
    } else {
      orderData.id = uuidv4()
      orderData.createdAt = dayjs().format('YYYY-MM-DD HH:mm:ss')
      // 新订单自动扣存单
      orderData = await deductFromDeposit(orderData)
      await addRecord(DATA_FILES.ORDERS, orderData)
      if (orderData.depositDeduction) {
        message.success(
          `添加成功，已从存单扣款 ¥${fmtMoney(orderData.depositDeduction)}`,
        )
      } else {
        message.success('添加成功')
      }
    }

    setModalVisible(false)
    loadData()
  }

  // 模板文本变化 → 实时解析（同时检查存单折扣）
  const handleImportTextChange = (text) => {
    setImportText(text)
    if (text.trim()) {
      const parsed = parseTemplateText(text, template)

      // 检查老板是否有生效存单和折扣
      const bossName = (parsed.bossName || '').trim()
      if (bossName) {
        const lowerBoss = bossName.toLowerCase()
        const activeDeposit = deposits.find(
          (d) =>
            d.bossName.trim().toLowerCase() === lowerBoss &&
            d.status === 'active' &&
            (parseFloat(d.remainingBalance) || 0) > 0,
        )
        if (activeDeposit) {
          parsed._depositDiscount = activeDeposit.discountRate
        }
      }

      setParsedData(parsed)
      importForm.setFieldsValue(parsed)
    } else {
      setParsedData(null)
      importForm.resetFields()
    }
  }

  // 确认导入
  const handleImport = async () => {
    if (!parsedData) {
      message.warning('请先粘贴报单内容')
      return
    }
    const values = importForm.getFieldsValue()
    let orderData = {
      ...values,
      id: uuidv4(),
      createdAt: dayjs().format('YYYY-MM-DD HH:mm:ss'),
    }

    // 自动同步老板和陪玩
    orderData = await syncBossAndCompanion(orderData)

    // 自动扣存单（到手已在解析时调整，此处仅扣余额）
    orderData = await deductFromDeposit(orderData)

    await addRecord(DATA_FILES.ORDERS, orderData)
    if (orderData.depositDeduction) {
      message.success(
        `导入成功，已从存单扣款 ¥${fmtMoney(orderData.depositDeduction)}`,
      )
    } else {
      message.success('导入成功')
    }
    setImportModalVisible(false)
    setImportText('')
    setParsedData(null)
    importForm.resetFields()
    loadData()
  }

  // 统计
  const todayStr = dayjs().format('YYYY-MM-DD')
  const todayOrders = orders.filter(
    (o) =>
      o.date === todayStr ||
      (o.orderTime && dayjs(o.orderTime).format('YYYY-MM-DD') === todayStr),
  )
  const totalIncome = orders.reduce((sum, o) => sum + (o.totalAmount || 0), 0)
  const totalProfit = orders.reduce((sum, o) => sum + calcStoreProfit(o), 0)

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
              onClick={() => {
                setDetailRecord(record)
                setDetailVisible(true)
              }}
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

  // 渲染表单字段
  const renderFormField = (field) => {
    switch (field.type) {
      case 'date':
        return <Input placeholder="如：2024-4-17、4月17日、今天" />
      case 'number':
        return <InputNumber style={{ width: '100%' }} placeholder="0" />
      case 'flag':
        return <Switch checkedChildren="是" unCheckedChildren="否" />
      default:
        return <Input placeholder={`请输入${field.label}`} />
    }
  }

  return (
    <div>
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="总订单数"
              value={orders.length}
              suffix="单"
              prefix={<FileTextOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="今日订单"
              value={todayOrders.length}
              suffix="单"
              prefix={<ThunderboltOutlined />}
              valueStyle={{ color: 'var(--color-info)' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="流水金额"
              value={totalIncome}
              formatter={(v) => fmtMoney(v)}
              prefix={
                <>
                  <FundOutlined /> ¥
                </>
              }
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="盈利"
              value={totalProfit}
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
        title="接单记录"
        extra={
          <Space>
            <Button
              icon={<SettingOutlined />}
              onClick={() =>
                navigate('/settings', { state: { expandTemplate: true } })
              }
            >
              配置订单模板
            </Button>
            <Button
              icon={<ImportOutlined />}
              onClick={() => setImportModalVisible(true)}
            >
              一键导入订单
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
              新增接单
            </Button>
          </Space>
        }
      >
        <Table
          columns={columns}
          dataSource={orders}
          rowKey="id"
          loading={loading}
          pagination={{
            pageSize: settings.pageSize || 15,
            showTotal: (total) => `共 ${total} 条`,
          }}
          size="small"
        />
      </Card>

      {/* 手动新增/编辑弹窗 */}
      <Modal
        title={editingOrder ? '编辑接单记录' : '新增接单记录'}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        width={650}
        destroyOnHidden
        afterOpenChange={(open) => {
          if (open && editingOrder) {
            form.setFieldsValue(editingOrder)
          }
        }}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Row gutter={16}>
            {template.map((field) => (
              <Col span={field.type === 'flag' ? 8 : 12} key={field.key}>
                <Form.Item
                  name={field.key}
                  label={field.label}
                  valuePropName={field.type === 'flag' ? 'checked' : 'value'}
                >
                  {renderFormField(field)}
                </Form.Item>
              </Col>
            ))}
          </Row>
        </Form>
      </Modal>

      {/* 模板导入弹窗 */}
      <Modal
        title="模板导入"
        open={importModalVisible}
        onOk={handleImport}
        onCancel={() => {
          setImportModalVisible(false)
          setImportText('')
          setParsedData(null)
          importForm.resetFields()
        }}
        okText="导入"
        cancelText="取消"
        width={900}
        destroyOnHidden
      >
        <Row gutter={16}>
          <Col span={10}>
            <Input.TextArea
              rows={14}
              placeholder={
                '请粘贴报单内容，例如：\n日期：4月17日\n管理：小李\n老板：张三\n陪玩：小红\n类型：王者荣耀\n起止时间：20:00-22:00\n时长：2\n单价：30\n总计：60\n抽成：18\n到手：42\n直属：是'
              }
              value={importText}
              onChange={(e) => handleImportTextChange(e.target.value)}
              style={{ fontFamily: 'monospace', fontSize: 13 }}
            />
          </Col>
          <Col span={14}>
            {parsedData ? (
              <Card
                size="small"
                title="解析结果（可编辑后导入）"
                styles={{ body: { padding: '8px 12px' } }}
              >
                <Form form={importForm} layout="vertical" size="small">
                  <Row gutter={[8, 0]}>
                    {template.map((field) => (
                      <Col
                        span={field.type === 'flag' ? 8 : 12}
                        key={field.key}
                      >
                        <Form.Item
                          name={field.key}
                          label={field.label}
                          valuePropName={
                            field.type === 'flag' ? 'checked' : 'value'
                          }
                          style={{ marginBottom: 8 }}
                        >
                          {renderFormField(field)}
                        </Form.Item>
                      </Col>
                    ))}
                  </Row>
                </Form>
                {parsedData._depositDiscount != null && (
                  <div
                    style={{
                      marginTop: 8,
                      padding: '6px 12px',
                      background: 'var(--color-bg-warning)',
                      borderRadius: 4,
                      border: '1px solid var(--color-border-warning)',
                      fontSize: 13,
                    }}
                  >
                    <span style={{ color: 'var(--color-warning)' }}>
                      该老板有存单
                      {parsedData._depositDiscount < 100 &&
                        `（${parsedData._depositDiscount / 10}折，折扣由店铺承担）`}
                    </span>
                  </div>
                )}
              </Card>
            ) : (
              <div
                style={{
                  height: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--color-text-tertiary)',
                }}
              >
                粘贴报单内容后自动解析
              </div>
            )}
          </Col>
        </Row>
      </Modal>

      {/* 详情弹窗 */}
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
                {field.type === 'flag'
                  ? detailRecord[field.key]
                    ? '是'
                    : '否'
                  : field.type === 'number' &&
                      [
                        'unitPrice',
                        'totalAmount',
                        'commissionAmount',
                        'actualIncome',
                      ].includes(field.key)
                    ? detailRecord[field.key] != null
                      ? `¥${detailRecord[field.key]}`
                      : '-'
                    : detailRecord[field.key] || '-'}
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
    </div>
  )
}

export default OrderManagement
