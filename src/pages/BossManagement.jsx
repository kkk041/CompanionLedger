import React, { useState, useEffect, useMemo } from 'react'
import {
  Table,
  Button,
  Modal,
  Form,
  Input,
  Space,
  Popconfirm,
  message,
  Card,
  Tag,
  Tooltip,
  Row,
  Col,
  Statistic,
  Descriptions,
  Timeline,
  Select,
  Badge,
} from 'antd'
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  QuestionCircleOutlined,
  EyeOutlined,
  UserOutlined,
  DollarOutlined,
  WalletOutlined,
  CrownOutlined,
  ShoppingOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import { v4 as uuidv4 } from 'uuid'
import {
  getAll,
  addRecord,
  updateRecord,
  deleteRecord,
  DATA_FILES,
} from '../services/storage'
import { fmtMoney } from '../utils/format'
import { useTheme } from '../contexts/ThemeContext'

function BossManagement() {
  const { settings } = useTheme()
  const [bosses, setBosses] = useState([])
  const [orders, setOrders] = useState([])
  const [deposits, setDeposits] = useState([])
  const [loading, setLoading] = useState(false)
  const [modalVisible, setModalVisible] = useState(false)
  const [editing, setEditing] = useState(null)
  const [detailVisible, setDetailVisible] = useState(false)
  const [detailRecord, setDetailRecord] = useState(null)
  const [form] = Form.useForm()
  const [searchText, setSearchText] = useState('')

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    const [bossesData, ordersData, depositsData] = await Promise.all([
      getAll(DATA_FILES.BOSSES),
      getAll(DATA_FILES.ORDERS),
      getAll(DATA_FILES.DEPOSITS),
    ])
    setBosses(bossesData)
    setOrders(ordersData)
    setDeposits(depositsData)
    setLoading(false)
  }

  const handleAdd = () => {
    setEditing(null)
    form.resetFields()
    setModalVisible(true)
  }

  const handleEdit = (record) => {
    setEditing(record)
    form.setFieldsValue(record)
    setModalVisible(true)
  }

  const handleDelete = async (id) => {
    const hasOrders = orders.some((o) => o.bossId === id)
    if (hasOrders) {
      message.warning('该老板有关联的接单记录，无法删除')
      return
    }
    await deleteRecord(DATA_FILES.BOSSES, id)
    message.success('删除成功')
    loadData()
  }

  const handleSubmit = async () => {
    const values = await form.validateFields()

    if (editing) {
      await updateRecord(DATA_FILES.BOSSES, editing.id, values)
      // 如果姓名变更，同步更新所有关联订单
      if (values.name !== editing.name) {
        const allOrders = await getAll(DATA_FILES.ORDERS)
        for (const order of allOrders) {
          if (order.bossId === editing.id || order.bossName === editing.name) {
            await updateRecord(DATA_FILES.ORDERS, order.id, {
              bossName: values.name,
            })
          }
        }
      }
      message.success('更新成功')
    } else {
      const record = {
        ...values,
        id: uuidv4(),
        createdAt: dayjs().format('YYYY-MM-DD HH:mm:ss'),
      }
      await addRecord(DATA_FILES.BOSSES, record)
      message.success('添加成功')
    }

    setModalVisible(false)
    loadData()
  }

  const getBossStats = (bossId, bossName) => {
    const bossOrders = orders.filter(
      (o) => o.bossId === bossId || (bossName && o.bossName === bossName),
    )
    const totalOrders = bossOrders.length
    // 老板实际消费：有存单扣款的用折后价，没有的用原价
    const totalSpent = bossOrders.reduce(
      (sum, o) =>
        sum +
        (o.depositDeduction != null
          ? parseFloat(o.depositDeduction) || 0
          : parseFloat(o.totalAmount) || 0),
      0,
    )
    const lastOrder = bossOrders.sort(
      (a, b) =>
        dayjs(b.date || b.createdAt).unix() -
        dayjs(a.date || a.createdAt).unix(),
    )[0]
    return { totalOrders, totalSpent, lastOrder }
  }

  // 获取老板的存单信息
  const getBossDeposit = (bossId, bossName) => {
    const lowerName = (bossName || '').toLowerCase()
    return deposits.find(
      (d) =>
        d.bossName &&
        d.bossName.trim().toLowerCase() === lowerName &&
        d.status === 'active' &&
        (parseFloat(d.remainingBalance) || 0) > 0,
    )
  }

  // 获取老板的所有订单（详情用）
  const getBossOrders = (bossId, bossName) => {
    return orders
      .filter(
        (o) => o.bossId === bossId || (bossName && o.bossName === bossName),
      )
      .sort(
        (a, b) =>
          dayjs(b.date || b.createdAt).unix() -
          dayjs(a.date || a.createdAt).unix(),
      )
  }

  // 顶部统计
  const totalStats = useMemo(() => {
    const totalBosses = bosses.length
    let totalSpentAll = 0
    let withDeposit = 0
    let totalDepositRemaining = 0

    bosses.forEach((b) => {
      const stats = getBossStats(b.id, b.name)
      totalSpentAll += stats.totalSpent
    })

    deposits
      .filter(
        (d) =>
          d.status === 'active' && (parseFloat(d.remainingBalance) || 0) > 0,
      )
      .forEach((d) => {
        withDeposit++
        totalDepositRemaining += parseFloat(d.remainingBalance) || 0
      })

    return { totalBosses, totalSpentAll, withDeposit, totalDepositRemaining }
  }, [bosses, orders, deposits])

  const showDetail = (record) => {
    setDetailRecord(record)
    setDetailVisible(true)
  }

  const columns = [
    {
      title: '姓名',
      dataIndex: 'name',
      key: 'name',
      render: (text) => (
        <Tag color="green" style={{ fontSize: 14 }}>
          {text}
        </Tag>
      ),
    },
    {
      title: '联系方式',
      dataIndex: 'contact',
      key: 'contact',
      render: (text) => text || '-',
    },
    {
      title: '来源',
      dataIndex: 'source',
      key: 'source',
      render: (text) => (text ? <Tag>{text}</Tag> : '-'),
    },
    {
      title: '下单数',
      key: 'totalOrders',
      align: 'center',
      sorter: (a, b) =>
        getBossStats(a.id, a.name).totalOrders -
        getBossStats(b.id, b.name).totalOrders,
      render: (_, record) => {
        const stats = getBossStats(record.id, record.name)
        return <span style={{ fontWeight: 'bold' }}>{stats.totalOrders}</span>
      },
    },
    {
      title: (
        <span>
          总消费{' '}
          <Tooltip title="有存单折扣的订单按折后价计算，不含赠送金额">
            <QuestionCircleOutlined
              style={{ color: 'var(--color-text-quaternary)', fontSize: 12 }}
            />
          </Tooltip>
        </span>
      ),
      key: 'totalSpent',
      align: 'right',
      sorter: (a, b) =>
        getBossStats(a.id, a.name).totalSpent -
        getBossStats(b.id, b.name).totalSpent,
      render: (_, record) => {
        const stats = getBossStats(record.id, record.name)
        return (
          <span style={{ color: 'var(--color-warning)', fontWeight: 'bold' }}>
            ¥{fmtMoney(stats.totalSpent)}
          </span>
        )
      },
    },
    {
      title: (
        <span>
          存单余额{' '}
          <Tooltip title="当前生效存单的剩余可用额度">
            <QuestionCircleOutlined
              style={{ color: 'var(--color-text-quaternary)', fontSize: 12 }}
            />
          </Tooltip>
        </span>
      ),
      key: 'deposit',
      align: 'right',
      render: (_, record) => {
        const dep = getBossDeposit(record.id, record.name)
        if (!dep)
          return (
            <span style={{ color: 'var(--color-text-tertiary)' }}>无存单</span>
          )
        return (
          <Tooltip
            title={`${dep.discountRate && dep.discountRate < 100 ? dep.discountRate / 10 + '折' : '无折扣'} · 总额 ¥${fmtMoney(dep.totalBalance)}`}
          >
            <span style={{ color: 'var(--color-success)', fontWeight: 'bold' }}>
              ¥{fmtMoney(dep.remainingBalance)}
            </span>
          </Tooltip>
        )
      },
    },
    {
      title: '最近下单',
      key: 'lastOrder',
      render: (_, record) => {
        const stats = getBossStats(record.id, record.name)
        if (!stats.lastOrder)
          return <span style={{ color: 'var(--color-text-tertiary)' }}>-</span>
        const d = stats.lastOrder.date || stats.lastOrder.createdAt
        return (
          <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
            {d}
          </span>
        )
      },
    },
    {
      title: '备注',
      dataIndex: 'remark',
      key: 'remark',
      ellipsis: true,
      render: (text) => text || '-',
    },
    {
      title: '操作',
      key: 'action',
      width: 130,
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
            title="确定删除？"
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

  const filteredBosses = bosses.filter((b) => {
    if (!searchText.trim()) return true
    const s = searchText.trim().toLowerCase()
    return (
      (b.name || '').toLowerCase().includes(s) ||
      (b.contact || '').toLowerCase().includes(s) ||
      (b.source || '').toLowerCase().includes(s) ||
      (b.gamePreference || '').toLowerCase().includes(s) ||
      (b.remark || '').toLowerCase().includes(s)
    )
  })

  return (
    <div>
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="总老板数"
              value={totalStats.totalBosses}
              suffix="人"
              prefix={<UserOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="总消费"
              value={totalStats.totalSpentAll}
              formatter={(v) => fmtMoney(v)}
              prefix={
                <>
                  <ShoppingOutlined /> ¥
                </>
              }
              valueStyle={{ color: 'var(--color-warning)' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="有存单老板"
              value={totalStats.withDeposit}
              suffix="人"
              prefix={<WalletOutlined />}
              valueStyle={{ color: 'var(--color-info)' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="存单总余额"
              value={totalStats.totalDepositRemaining}
              formatter={(v) => fmtMoney(v)}
              prefix={
                <>
                  <SafetyCertificateOutlined /> ¥
                </>
              }
              valueStyle={{ color: 'var(--color-success)' }}
            />
          </Card>
        </Col>
      </Row>

      <Card
        title={`消费明细 (共 ${bosses.length} 人)`}
        size="small"
        extra={
          <Space>
            <Input.Search
              placeholder="搜索姓名/联系方式/来源/备注"
              allowClear
              onChange={(e) => setSearchText(e.target.value)}
              style={{ width: 250 }}
              size="small"
            />
            <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
              添加老板
            </Button>
          </Space>
        }
      >
        <Table
          columns={columns}
          dataSource={filteredBosses}
          rowKey="id"
          loading={loading}
          pagination={{
            pageSize: settings.pageSize || 15,
            showTotal: (total) => `共 ${total} 条`,
          }}
          size="small"
        />
      </Card>

      {/* 新增/编辑弹窗 */}
      <Modal
        title={editing ? '编辑老板' : '添加老板'}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        destroyOnHidden
        width={500}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            name="name"
            label="姓名"
            rules={[{ required: true, message: '请输入姓名' }]}
          >
            <Input placeholder="输入老板姓名" />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="contact" label="联系方式">
                <Input placeholder="手机号/微信号等" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="source" label="来源渠道">
                <Select
                  allowClear
                  placeholder="选择或输入来源"
                  options={[
                    { value: '微信', label: '微信' },
                    { value: 'QQ', label: 'QQ' },
                    { value: '抖音', label: '抖音' },
                    { value: '小红书', label: '小红书' },
                    { value: '朋友介绍', label: '朋友介绍' },
                    { value: '老客户', label: '老客户' },
                    { value: '其他', label: '其他' },
                  ]}
                  showSearch
                />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="gamePreference" label="常玩游戏">
                <Input placeholder="如：王者荣耀、和平精英" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="level" label="客户等级">
                <Select
                  allowClear
                  placeholder="选择客户等级"
                  options={[
                    { value: '普通', label: '普通' },
                    { value: '重要', label: '重要' },
                    { value: 'VIP', label: 'VIP' },
                  ]}
                />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="remark" label="备注">
            <Input.TextArea
              rows={2}
              placeholder="备注信息（偏好、注意事项等）"
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* 老板详情弹窗 */}
      <Modal
        title="老板详情"
        open={detailVisible}
        onCancel={() => setDetailVisible(false)}
        footer={null}
        width={700}
      >
        {detailRecord &&
          (() => {
            const stats = getBossStats(detailRecord.id, detailRecord.name)
            const dep = getBossDeposit(detailRecord.id, detailRecord.name)
            const bossOrders = getBossOrders(detailRecord.id, detailRecord.name)
            return (
              <>
                <Descriptions
                  column={2}
                  bordered
                  size="small"
                  style={{ marginTop: 16 }}
                >
                  <Descriptions.Item label="姓名">
                    <Tag color="green" style={{ fontSize: 14 }}>
                      {detailRecord.name}
                    </Tag>
                    {detailRecord.level && (
                      <Tag
                        color={
                          detailRecord.level === 'VIP'
                            ? 'gold'
                            : detailRecord.level === '重要'
                              ? 'blue'
                              : 'default'
                        }
                        icon={
                          detailRecord.level === 'VIP' ? (
                            <CrownOutlined />
                          ) : undefined
                        }
                      >
                        {detailRecord.level}
                      </Tag>
                    )}
                  </Descriptions.Item>
                  <Descriptions.Item label="联系方式">
                    {detailRecord.contact || '-'}
                  </Descriptions.Item>
                  <Descriptions.Item label="来源渠道">
                    {detailRecord.source || '-'}
                  </Descriptions.Item>
                  <Descriptions.Item label="常玩游戏">
                    {detailRecord.gamePreference || '-'}
                  </Descriptions.Item>
                  <Descriptions.Item label="下单数">
                    <span style={{ fontWeight: 'bold' }}>
                      {stats.totalOrders} 单
                    </span>
                  </Descriptions.Item>
                  <Descriptions.Item label="总消费">
                    <span
                      style={{
                        color: 'var(--color-warning)',
                        fontWeight: 'bold',
                      }}
                    >
                      ¥{fmtMoney(stats.totalSpent)}
                    </span>
                  </Descriptions.Item>
                  {dep && (
                    <>
                      <Descriptions.Item label="存单余额">
                        <span
                          style={{
                            color: 'var(--color-success)',
                            fontWeight: 'bold',
                          }}
                        >
                          ¥{fmtMoney(dep.remainingBalance)}
                        </span>
                        <span
                          style={{
                            color: 'var(--color-text-tertiary)',
                            marginLeft: 8,
                          }}
                        >
                          / ¥{fmtMoney(dep.totalBalance)}
                        </span>
                      </Descriptions.Item>
                      <Descriptions.Item label="存单折扣">
                        {dep.discountRate && dep.discountRate < 100
                          ? `${dep.discountRate / 10}折`
                          : '无折扣'}
                      </Descriptions.Item>
                    </>
                  )}
                  <Descriptions.Item label="添加时间">
                    {detailRecord.createdAt}
                  </Descriptions.Item>
                  <Descriptions.Item label="最近下单">
                    {stats.lastOrder
                      ? stats.lastOrder.date || stats.lastOrder.createdAt
                      : '-'}
                  </Descriptions.Item>
                  {detailRecord.remark && (
                    <Descriptions.Item label="备注" span={2}>
                      {detailRecord.remark}
                    </Descriptions.Item>
                  )}
                </Descriptions>

                <Card
                  size="small"
                  title={`下单记录 (${bossOrders.length} 单)`}
                  style={{ marginTop: 16 }}
                  styles={{ body: { maxHeight: 300, overflowY: 'auto' } }}
                >
                  {bossOrders.length === 0 ? (
                    <div
                      style={{
                        color: 'var(--color-text-tertiary)',
                        textAlign: 'center',
                        padding: 16,
                      }}
                    >
                      暂无下单记录
                    </div>
                  ) : (
                    <Timeline
                      items={bossOrders.map((o) => ({
                        color: o.depositDeduction ? 'green' : 'blue',
                        children: (
                          <div>
                            <div>
                              <Tag color="blue">
                                {o.companionName || '未知陪玩'}
                              </Tag>
                              {o.orderType && (
                                <Tag color="default">{o.orderType}</Tag>
                              )}
                              <span
                                style={{ fontWeight: 'bold', marginLeft: 4 }}
                              >
                                ¥{fmtMoney(o.totalAmount)}
                              </span>
                            </div>
                            <div
                              style={{
                                fontSize: 12,
                                color: 'var(--color-text-tertiary)',
                              }}
                            >
                              {o.date || o.createdAt}
                              {o.depositDeduction != null && (
                                <span style={{ color: 'var(--color-success)' }}>
                                  {' '}
                                  · 存单扣款 ¥{fmtMoney(o.depositDeduction)}
                                  {o.depositDiscount &&
                                    o.depositDiscount < 100 &&
                                    ` (${o.depositDiscount / 10}折)`}
                                </span>
                              )}{' '}
                              · 到手 ¥{fmtMoney(o.actualIncome)} · 抽成 ¥
                              {fmtMoney(o.commissionAmount)}
                            </div>
                          </div>
                        ),
                      }))}
                    />
                  )}
                </Card>
              </>
            )
          })()}
      </Modal>
    </div>
  )
}

export default BossManagement
