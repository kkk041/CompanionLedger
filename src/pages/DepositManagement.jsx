import React, { useState, useEffect, useMemo } from 'react'
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
  Tag,
  Select,
  AutoComplete,
  Row,
  Col,
  Descriptions,
  Badge,
  Statistic,
  Timeline,
  Tooltip,
} from 'antd'
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  EyeOutlined,
  WalletOutlined,
  DollarOutlined,
  RollbackOutlined,
  QuestionCircleOutlined,
  GiftOutlined,
  AccountBookOutlined,
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

function DepositManagement() {
  const { settings } = useTheme()
  const [deposits, setDeposits] = useState([])
  const [bosses, setBosses] = useState([])
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(false)
  const [modalVisible, setModalVisible] = useState(false)
  const [editing, setEditing] = useState(null)
  const [detailVisible, setDetailVisible] = useState(false)
  const [detailRecord, setDetailRecord] = useState(null)
  const [refundVisible, setRefundVisible] = useState(false)
  const [refundRecord, setRefundRecord] = useState(null)
  const [form] = Form.useForm()
  const [searchText, setSearchText] = useState('')

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    const [depositsData, bossesData, ordersData] = await Promise.all([
      getAll(DATA_FILES.DEPOSITS),
      getAll(DATA_FILES.BOSSES),
      getAll(DATA_FILES.ORDERS),
    ])
    setDeposits(depositsData)
    setBosses(bossesData)
    setOrders(ordersData)
    setLoading(false)
  }

  // 总统计
  const totalStats = useMemo(() => {
    const totalDeposit = deposits.reduce(
      (sum, d) => sum + (parseFloat(d.depositAmount) || 0),
      0,
    )
    const totalBonus = deposits.reduce(
      (sum, d) => sum + (parseFloat(d.bonusAmount) || 0),
      0,
    )
    const totalRemaining = deposits.reduce(
      (sum, d) => sum + (parseFloat(d.remainingBalance) || 0),
      0,
    )
    const activeCount = deposits.filter((d) => d.status === 'active').length
    return { totalDeposit, totalBonus, totalRemaining, activeCount }
  }, [deposits])

  // 获取存单的消费流水
  const getDepositTransactions = (depositId) => {
    return orders
      .filter((o) => o.depositId === depositId)
      .sort((a, b) => dayjs(b.createdAt).unix() - dayjs(a.createdAt).unix())
  }

  const handleAdd = () => {
    setEditing(null)
    form.resetFields()
    form.setFieldsValue({
      discountRate: 100,
      bonusAmount: 0,
      status: 'active',
    })
    setModalVisible(true)
  }

  const handleEdit = (record) => {
    setEditing(record)
    setModalVisible(true)
  }

  const handleDelete = async (id) => {
    const deposit = deposits.find((d) => d.id === id)
    const relatedOrders = orders.filter((o) => o.depositId === id)

    if (relatedOrders.length > 0) {
      if (deposit && deposit.status === 'refunded') {
        // 已退款存单：到手已在下单时按折扣计算完成，可直接删除
        Modal.confirm({
          title: '删除已退款存单',
          content: (
            <div style={{ marginTop: 8 }}>
              <p>
                该存单有 <strong>{relatedOrders.length}</strong>{' '}
                条关联消费记录。
              </p>
              <p style={{ color: 'var(--color-text-tertiary)' }}>
                订单中的到手金额已在下单时按折扣计算完成，删除存单不会影响已有订单数据。
              </p>
            </div>
          ),
          okText: '确认删除',
          okButtonProps: { danger: true },
          onOk: async () => {
            await deleteRecord(DATA_FILES.DEPOSITS, id)
            message.success('删除成功')
            loadData()
          },
        })
      } else {
        message.warning(
          '该存单有关联的消费记录，无法直接删除。如需删除，请先办理退款。',
        )
      }
      return
    }
    await deleteRecord(DATA_FILES.DEPOSITS, id)
    message.success('删除成功')
    loadData()
  }

  const handleSubmit = async () => {
    const values = await form.validateFields()
    const depositAmount = parseFloat(values.depositAmount) || 0
    const bonusAmount = parseFloat(values.bonusAmount) || 0
    const totalBalance = depositAmount + bonusAmount

    const depositData = {
      ...values,
      depositAmount,
      bonusAmount,
      totalBalance,
    }

    if (editing) {
      // 编辑时重算剩余余额：新总额 - 已消费
      const consumed =
        (editing.totalBalance || 0) - (editing.remainingBalance || 0)
      depositData.remainingBalance = Math.max(0, totalBalance - consumed)
      await updateRecord(DATA_FILES.DEPOSITS, editing.id, depositData)
      message.success('更新成功')
    } else {
      depositData.id = uuidv4()
      depositData.remainingBalance = totalBalance
      depositData.createdAt = dayjs().format('YYYY-MM-DD HH:mm:ss')
      await addRecord(DATA_FILES.DEPOSITS, depositData)
      message.success('添加成功')
    }

    setModalVisible(false)
    loadData()
  }

  const showDetail = (record) => {
    setDetailRecord(record)
    setDetailVisible(true)
  }

  // 退款计算
  const calcRefund = (record) => {
    const remaining = parseFloat(record.remainingBalance) || 0
    const total = parseFloat(record.totalBalance) || 0
    const deposit = parseFloat(record.depositAmount) || 0
    if (remaining <= 0 || total <= 0) return { refundAmount: 0, remaining: 0 }
    // 实充占比 = 充值金额 / 总额度，赠送部分不退
    const realRatio = deposit / total
    const refundAmount = Math.round(remaining * realRatio * 100) / 100
    return { refundAmount, remaining }
  }

  const handleRefund = (record) => {
    setRefundRecord(record)
    setRefundVisible(true)
  }

  const confirmRefund = async () => {
    if (!refundRecord) return
    await updateRecord(DATA_FILES.DEPOSITS, refundRecord.id, {
      remainingBalance: 0,
      status: 'refunded',
      refundedAt: dayjs().format('YYYY-MM-DD HH:mm:ss'),
      refundAmount: calcRefund(refundRecord).refundAmount,
    })
    message.success(
      `退款成功，应退 ¥${calcRefund(refundRecord).refundAmount.toFixed(2)}`,
    )
    setRefundVisible(false)
    setRefundRecord(null)
    loadData()
  }

  const statusMap = {
    active: {
      color: 'green',
      text: '使用中',
      desc: '存单正常生效，下单时自动从余额中扣款',
      detail:
        '存单正常生效中。每次新增或导入订单时，系统会自动查找该老板的生效存单，按折扣计算后从余额中扣除。陌玩的抽成/到手不受影响，折扣仅影响老板的存单扣款金额。',
    },
    exhausted: {
      color: 'orange',
      text: '已用完',
      desc: '余额已扣至 0，系统自动标记，不再扣款',
      detail:
        '存单余额已扣至 0，系统自动将状态切换为“已用完”。后续该老板的订单将不再触发存单扣款，按正常订单处理。如需继续使用存单，请新增一张新存单。',
    },
    expired: {
      color: 'red',
      text: '已过期',
      desc: '手动标记存单过期，剩余额度作废，不再扣款',
      detail:
        '由管理员手动标记存单过期。过期后剩余额度作废不可使用，也不可退款。适用于双方约定了有效期但未用完的情况。如需恢复，可编辑状态改回“使用中”。',
    },
    frozen: {
      color: 'blue',
      text: '已冻结',
      desc: '手动暂停存单，暂不扣款，恢复后改回“使用中”即可',
      detail:
        '由管理员手动冻结存单，冻结期间不会触发扣款，余额保留不变。适用于与老板有纠纷、暂停合作等情况。解决后编辑状态改回“使用中”即可恢复扣款。',
    },
    refunded: {
      color: 'purple',
      text: '已退款',
      desc: '存单已退款，余额清零，赠送部分不退',
      detail:
        '存单已办理退款，余额清零不可恢复。退款金额按“剩余余额 × 实充占比”计算，赠送部分不退。已产生的消费记录不受影响，可在详情中查看历史流水。',
    },
  }

  const columns = [
    {
      title: '老板',
      dataIndex: 'bossName',
      key: 'bossName',
      render: (text) => (text ? <Tag color="green">{text}</Tag> : '-'),
    },
    {
      title: '充值金额',
      dataIndex: 'depositAmount',
      key: 'depositAmount',
      align: 'right',
      sorter: (a, b) =>
        (parseFloat(a.depositAmount) || 0) - (parseFloat(b.depositAmount) || 0),
      render: (v) => <span style={{ fontWeight: 'bold' }}>¥{fmtMoney(v)}</span>,
    },
    {
      title: '赠送金额',
      dataIndex: 'bonusAmount',
      key: 'bonusAmount',
      align: 'right',
      sorter: (a, b) =>
        (parseFloat(a.bonusAmount) || 0) - (parseFloat(b.bonusAmount) || 0),
      render: (v) =>
        v > 0 ? (
          <span style={{ color: 'var(--color-warning)' }}>¥{fmtMoney(v)}</span>
        ) : (
          '-'
        ),
    },
    {
      title: '总额度',
      dataIndex: 'totalBalance',
      key: 'totalBalance',
      align: 'right',
      sorter: (a, b) =>
        (parseFloat(a.totalBalance) || 0) - (parseFloat(b.totalBalance) || 0),
      render: (v) => (
        <span style={{ color: 'var(--color-info)', fontWeight: 'bold' }}>
          ¥{fmtMoney(v)}
        </span>
      ),
    },
    {
      title: '剩余余额',
      dataIndex: 'remainingBalance',
      key: 'remainingBalance',
      align: 'right',
      sorter: (a, b) =>
        (parseFloat(a.remainingBalance) || 0) -
        (parseFloat(b.remainingBalance) || 0),
      render: (v) => (
        <span
          style={{
            color: v > 0 ? 'var(--color-success)' : 'var(--color-danger)',
            fontWeight: 'bold',
          }}
        >
          ¥{fmtMoney(v)}
        </span>
      ),
    },
    {
      title: (
        <span>
          剩余实际{' '}
          <Tooltip title="剩余余额中扣除赠送部分，即实际充值所剩的金额">
            <QuestionCircleOutlined
              style={{ color: 'var(--color-text-quaternary)', fontSize: 12 }}
            />
          </Tooltip>
        </span>
      ),
      key: 'remainingReal',
      align: 'right',
      sorter: (a, b) => {
        const calcReal = (d) => {
          const remaining = parseFloat(d.remainingBalance) || 0
          const total = parseFloat(d.totalBalance) || 0
          const deposit = parseFloat(d.depositAmount) || 0
          if (remaining <= 0 || total <= 0) return 0
          return Math.round(remaining * (deposit / total) * 100) / 100
        }
        return calcReal(a) - calcReal(b)
      },
      render: (_, record) => {
        const remaining = parseFloat(record.remainingBalance) || 0
        const total = parseFloat(record.totalBalance) || 0
        const deposit = parseFloat(record.depositAmount) || 0
        if (remaining <= 0 || total <= 0)
          return <span style={{ color: 'var(--color-danger)' }}>¥0.00</span>
        const realRatio = deposit / total
        const realRemaining = Math.round(remaining * realRatio * 100) / 100
        return (
          <span style={{ color: 'var(--color-purple)', fontWeight: 'bold' }}>
            ¥{fmtMoney(realRemaining)}
          </span>
        )
      },
    },
    {
      title: '折扣',
      dataIndex: 'discountRate',
      key: 'discountRate',
      align: 'center',
      render: (v) => {
        if (!v || v >= 100) return '-'
        return <Tag color="volcano">{v / 10}折</Tag>
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      align: 'center',
      render: (v) => {
        const s = statusMap[v] || statusMap.active
        return (
          <Tooltip title={s.desc}>
            <Badge
              status={v === 'active' ? 'processing' : 'default'}
              text={<Tag color={s.color}>{s.text}</Tag>}
            />
          </Tooltip>
        )
      },
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
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
          {record.status === 'active' &&
            (parseFloat(record.remainingBalance) || 0) > 0 && (
              <Tooltip title="退款">
                <Button
                  type="link"
                  size="small"
                  icon={<RollbackOutlined />}
                  style={{ color: 'var(--color-purple)' }}
                  onClick={() => handleRefund(record)}
                />
              </Tooltip>
            )}
          <Popconfirm
            title="确定删除此存单？"
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

  // 老板下拉选项
  const bossOptions = bosses.map((b) => ({
    value: b.name,
    label: b.name,
  }))

  return (
    <div>
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="生效存单"
              value={totalStats.activeCount}
              suffix="张"
              prefix={<WalletOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="总充值"
              value={totalStats.totalDeposit}
              formatter={(v) => fmtMoney(v)}
              prefix={
                <>
                  <AccountBookOutlined /> ¥
                </>
              }
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="总赠送"
              value={totalStats.totalBonus}
              formatter={(v) => fmtMoney(v)}
              prefix={
                <>
                  <GiftOutlined /> ¥
                </>
              }
              valueStyle={{ color: 'var(--color-warning)' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="总剩余"
              value={totalStats.totalRemaining}
              formatter={(v) => fmtMoney(v)}
              prefix={
                <>
                  <DollarOutlined /> ¥
                </>
              }
              valueStyle={{ color: 'var(--color-success)' }}
            />
          </Card>
        </Col>
      </Row>

      <Card
        title={
          <Space>
            {`存单管理 (共 ${deposits.length} 张)`}
            <Tooltip
              title={
                <div>
                  <div style={{ marginBottom: 6, fontWeight: 'bold' }}>
                    存单状态说明：
                  </div>
                  {Object.values(statusMap).map((s) => (
                    <div
                      key={s.text}
                      style={{
                        marginBottom: 6,
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 6,
                      }}
                    >
                      <Tag color={s.color} style={{ flexShrink: 0 }}>
                        {s.text}
                      </Tag>
                      <span>{s.detail}</span>
                    </div>
                  ))}
                </div>
              }
              styles={{ root: { maxWidth: 420 } }}
            >
              <QuestionCircleOutlined
                style={{
                  color: 'var(--color-text-tertiary)',
                  cursor: 'pointer',
                }}
              />
            </Tooltip>
          </Space>
        }
        extra={
          <Space>
            <Input.Search
              placeholder="搜索老板/备注"
              allowClear
              onChange={(e) => setSearchText(e.target.value)}
              style={{ width: 200 }}
            />
            <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
              新增存单
            </Button>
          </Space>
        }
      >
        <Table
          columns={columns}
          dataSource={deposits.filter((d) => {
            if (!searchText.trim()) return true
            const s = searchText.trim().toLowerCase()
            return (
              (d.bossName || '').toLowerCase().includes(s) ||
              (d.remark || '').toLowerCase().includes(s)
            )
          })}
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
        title={editing ? '编辑存单' : '新增存单'}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        width={500}
        destroyOnHidden
        afterOpenChange={(open) => {
          if (open && editing) {
            form.setFieldsValue(editing)
          }
        }}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            name="bossName"
            label="老板"
            rules={[{ required: true, message: '请选择或输入老板' }]}
          >
            <AutoComplete
              allowClear
              placeholder="选择老板或输入新老板名"
              options={bossOptions}
              filterOption={(input, option) =>
                option.label.toLowerCase().includes(input.toLowerCase())
              }
            />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="depositAmount"
                label="充值金额"
                rules={[{ required: true, message: '请输入充值金额' }]}
              >
                <InputNumber
                  style={{ width: '100%' }}
                  min={0}
                  precision={2}
                  prefix="¥"
                  placeholder="实际充值金额"
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="bonusAmount" label="赠送金额">
                <InputNumber
                  style={{ width: '100%' }}
                  min={0}
                  precision={2}
                  prefix="¥"
                  placeholder="赠送额度（可选）"
                />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="discountRate"
                label="折扣（百分比）"
                tooltip="输入 80 表示 8折，100 表示无折扣"
              >
                <InputNumber
                  style={{ width: '100%' }}
                  min={1}
                  max={100}
                  precision={0}
                  addonAfter="%"
                  placeholder="100 = 无折扣"
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="status" label="状态">
                <Select
                  options={[
                    { value: 'active', label: '使用中' },
                    { value: 'exhausted', label: '已用完' },
                    { value: 'expired', label: '已过期' },
                    { value: 'frozen', label: '已冻结' },
                    { value: 'refunded', label: '已退款' },
                  ]}
                />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="remark" label="备注">
            <Input.TextArea rows={2} placeholder="备注信息（可选）" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 详情弹窗 */}
      <Modal
        title="存单详情"
        open={detailVisible}
        onCancel={() => setDetailVisible(false)}
        footer={null}
        width={650}
      >
        {detailRecord && (
          <>
            <Descriptions
              column={2}
              bordered
              size="small"
              style={{ marginTop: 16 }}
            >
              <Descriptions.Item label="老板">
                <Tag color="green">{detailRecord.bossName}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="状态">
                <Tag color={statusMap[detailRecord.status]?.color}>
                  {statusMap[detailRecord.status]?.text}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="充值金额">
                ¥{fmtMoney(detailRecord.depositAmount)}
              </Descriptions.Item>
              <Descriptions.Item label="赠送金额">
                ¥{fmtMoney(detailRecord.bonusAmount)}
              </Descriptions.Item>
              <Descriptions.Item label="总额度">
                <span
                  style={{ color: 'var(--color-info)', fontWeight: 'bold' }}
                >
                  ¥{fmtMoney(detailRecord.totalBalance)}
                </span>
              </Descriptions.Item>
              <Descriptions.Item label="剩余余额">
                <span
                  style={{ color: 'var(--color-success)', fontWeight: 'bold' }}
                >
                  ¥{fmtMoney(detailRecord.remainingBalance)}
                </span>
              </Descriptions.Item>
              <Descriptions.Item label="折扣">
                {detailRecord.discountRate && detailRecord.discountRate < 100
                  ? `${detailRecord.discountRate / 10}折`
                  : '无折扣'}
              </Descriptions.Item>
              <Descriptions.Item label="创建时间">
                {detailRecord.createdAt}
              </Descriptions.Item>
              {detailRecord.remark && (
                <Descriptions.Item label="备注" span={2}>
                  {detailRecord.remark}
                </Descriptions.Item>
              )}
              {detailRecord.status === 'refunded' && (
                <>
                  <Descriptions.Item label="退款金额">
                    <span
                      style={{
                        color: 'var(--color-purple)',
                        fontWeight: 'bold',
                      }}
                    >
                      ¥{fmtMoney(detailRecord.refundAmount)}
                    </span>
                  </Descriptions.Item>
                  <Descriptions.Item label="退款时间">
                    {detailRecord.refundedAt}
                  </Descriptions.Item>
                </>
              )}
            </Descriptions>

            <Card
              size="small"
              title="消费流水"
              style={{ marginTop: 16 }}
              styles={{ body: { maxHeight: 300, overflowY: 'auto' } }}
            >
              {(() => {
                const transactions = getDepositTransactions(detailRecord.id)
                if (transactions.length === 0) {
                  return (
                    <div
                      style={{
                        color: 'var(--color-text-tertiary)',
                        textAlign: 'center',
                        padding: 16,
                      }}
                    >
                      暂无消费记录
                    </div>
                  )
                }
                return (
                  <Timeline
                    items={transactions.map((t) => ({
                      color: 'blue',
                      children: (
                        <div>
                          <div>
                            <Tag color="blue">{t.companionName || '未知'}</Tag>
                            陪 <Tag color="green">{t.bossName}</Tag>
                            {t.orderType && <span>（{t.orderType}）</span>}
                          </div>
                          <div
                            style={{
                              fontSize: 12,
                              color: 'var(--color-text-tertiary)',
                            }}
                          >
                            {t.date || t.createdAt} · 原价 ¥{t.totalAmount}
                            {t.depositDeduction != null && (
                              <span style={{ color: 'var(--color-danger)' }}>
                                {' '}
                                · 扣款 ¥{fmtMoney(t.depositDeduction)}
                              </span>
                            )}
                          </div>
                        </div>
                      ),
                    }))}
                  />
                )
              })()}
            </Card>
          </>
        )}
      </Modal>

      {/* 退款确认弹窗 */}
      <Modal
        title="存单退款"
        open={refundVisible}
        onOk={confirmRefund}
        onCancel={() => {
          setRefundVisible(false)
          setRefundRecord(null)
        }}
        okText="确认退款"
        okButtonProps={{ danger: true }}
        width={500}
      >
        {refundRecord &&
          (() => {
            const { refundAmount, remaining } = calcRefund(refundRecord)
            const deposit = parseFloat(refundRecord.depositAmount) || 0
            const bonus = parseFloat(refundRecord.bonusAmount) || 0
            const total = parseFloat(refundRecord.totalBalance) || 0
            const consumed = total - remaining
            const realRatio = total > 0 ? deposit / total : 0
            return (
              <>
                <Descriptions
                  column={1}
                  bordered
                  size="small"
                  style={{ marginTop: 16 }}
                >
                  <Descriptions.Item label="老板">
                    <Tag color="green">{refundRecord.bossName}</Tag>
                  </Descriptions.Item>
                  <Descriptions.Item label="充值金额">
                    ¥{deposit.toFixed(2)}
                  </Descriptions.Item>
                  <Descriptions.Item label="赠送金额">
                    ¥{bonus.toFixed(2)}
                  </Descriptions.Item>
                  <Descriptions.Item label="总额度">
                    ¥{deposit.toFixed(2)} + ¥{bonus.toFixed(2)} = ¥
                    {total.toFixed(2)}
                  </Descriptions.Item>
                  <Descriptions.Item label="已消费">
                    <span style={{ color: 'var(--color-danger)' }}>
                      ¥{consumed.toFixed(2)}
                    </span>
                  </Descriptions.Item>
                  <Descriptions.Item label="剩余余额">
                    ¥{total.toFixed(2)} - ¥{consumed.toFixed(2)} = ¥
                    {remaining.toFixed(2)}
                  </Descriptions.Item>
                  <Descriptions.Item label="实充占比">
                    ¥{deposit.toFixed(2)} ÷ ¥{total.toFixed(2)} ={' '}
                    {(realRatio * 100).toFixed(1)}%
                  </Descriptions.Item>
                  <Descriptions.Item label="应退金额">
                    <span
                      style={{
                        color: 'var(--color-purple)',
                        fontWeight: 'bold',
                        fontSize: 16,
                      }}
                    >
                      ¥{refundAmount.toFixed(2)}
                    </span>
                  </Descriptions.Item>
                </Descriptions>
                <Card
                  size="small"
                  style={{
                    marginTop: 12,
                    background: 'var(--color-bg-subtle)',
                    border: '1px dashed var(--color-border-subtle)',
                  }}
                >
                  <div
                    style={{
                      fontSize: 12,
                      color: 'var(--color-text-secondary)',
                      lineHeight: 1.8,
                    }}
                  >
                    <div style={{ fontWeight: 'bold', marginBottom: 4 }}>
                      计算说明：
                    </div>
                    <div>
                      1. 总额度 = 充值金额 + 赠送金额 = ¥{deposit.toFixed(2)} +
                      ¥{bonus.toFixed(2)} = <b>¥{total.toFixed(2)}</b>
                    </div>
                    <div>
                      2. 已消费 = 总额度 - 剩余余额 = ¥{total.toFixed(2)} - ¥
                      {remaining.toFixed(2)} = <b>¥{consumed.toFixed(2)}</b>
                    </div>
                    <div>
                      3. 实充占比 = 充值金额 ÷ 总额度 = ¥{deposit.toFixed(2)} ÷
                      ¥{total.toFixed(2)} ={' '}
                      <b>{(realRatio * 100).toFixed(1)}%</b>
                    </div>
                    <div>
                      4.{' '}
                      <b>
                        应退金额 = 剩余余额 × 实充占比 = ¥{remaining.toFixed(2)}{' '}
                        × {(realRatio * 100).toFixed(1)}% ={' '}
                        <span style={{ color: 'var(--color-purple)' }}>
                          ¥{refundAmount.toFixed(2)}
                        </span>
                      </b>
                    </div>
                    <div
                      style={{
                        marginTop: 4,
                        color: 'var(--color-text-tertiary)',
                      }}
                    >
                      ※ 赠送部分不享受退款，仅退还剩余余额中实际充值的部分
                    </div>
                  </div>
                </Card>
              </>
            )
          })()}
      </Modal>
    </div>
  )
}

export default DepositManagement
