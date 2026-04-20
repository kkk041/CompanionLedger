import React, { useState, useEffect, useMemo } from 'react'
import {
  Card,
  Row,
  Col,
  Statistic,
  Table,
  Tag,
  DatePicker,
  Space,
  Empty,
  Segmented,
  Tooltip,
} from 'antd'
import {
  TrophyOutlined,
  ClockCircleOutlined,
  DollarOutlined,
  TeamOutlined,
  CrownOutlined,
  RiseOutlined,
  QuestionCircleOutlined,
  FundOutlined,
  PayCircleOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import { getAll, DATA_FILES } from '../services/storage'
import { fmtMoney, calcStoreProfit } from '../utils/format'

const { RangePicker } = DatePicker

function DataAnalysis() {
  const [orders, setOrders] = useState([])
  const [companions, setCompanions] = useState([])
  const [bosses, setBosses] = useState([])
  const [deposits, setDeposits] = useState([])
  const [loading, setLoading] = useState(false)
  const [dateRange, setDateRange] = useState(null)
  const [rankType, setRankType] = useState('duration')

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    const [ordersData, companionsData, bossesData, depositsData] =
      await Promise.all([
        getAll(DATA_FILES.ORDERS),
        getAll(DATA_FILES.COMPANIONS),
        getAll(DATA_FILES.BOSSES),
        getAll(DATA_FILES.DEPOSITS),
      ])
    setOrders(ordersData)
    setCompanions(companionsData)
    setBosses(bossesData)
    setDeposits(depositsData)
    setLoading(false)
  }

  // 根据日期范围过滤
  const filteredOrders = useMemo(() => {
    if (!dateRange || !dateRange[0] || !dateRange[1]) return orders
    const start = dateRange[0].startOf('day')
    const end = dateRange[1].endOf('day')
    return orders.filter((o) => {
      const t = dayjs(o.orderTime)
      return t.isAfter(start) && t.isBefore(end)
    })
  }, [orders, dateRange])

  // 总统计
  const totalStats = useMemo(() => {
    const totalOrders = filteredOrders.length
    const totalDuration = filteredOrders.reduce(
      (sum, o) => sum + (parseFloat(o.duration) || 0),
      0,
    )
    const totalAmount = filteredOrders.reduce(
      (sum, o) => sum + (parseFloat(o.totalAmount) || 0),
      0,
    )
    const totalCommission = filteredOrders.reduce(
      (sum, o) => sum + (parseFloat(o.commissionAmount) || 0),
      0,
    )
    const totalProfit = filteredOrders.reduce(
      (sum, o) => sum + calcStoreProfit(o),
      0,
    )
    const avgOrderAmount = totalOrders > 0 ? totalAmount / totalOrders : 0
    return {
      totalOrders,
      totalDuration,
      totalAmount,
      totalCommission,
      totalProfit,
      avgOrderAmount,
    }
  }, [filteredOrders])

  // 陪玩排行
  const companionRanking = useMemo(() => {
    const map = {}
    filteredOrders.forEach((o) => {
      if (!map[o.companionId]) {
        map[o.companionId] = {
          companionId: o.companionId,
          name: o.companionName || '未知',
          totalOrders: 0,
          totalDuration: 0,
          totalAmount: 0,
          totalCommission: 0,
          storeProfit: 0,
        }
      }
      map[o.companionId].totalOrders += 1
      map[o.companionId].totalDuration += parseFloat(o.duration) || 0
      map[o.companionId].totalAmount += parseFloat(o.totalAmount) || 0
      map[o.companionId].totalCommission += parseFloat(o.commissionAmount) || 0
      map[o.companionId].storeProfit += calcStoreProfit(o)
    })
    const list = Object.values(map)
    if (rankType === 'duration') {
      list.sort((a, b) => b.totalDuration - a.totalDuration)
    } else if (rankType === 'amount') {
      list.sort((a, b) => b.totalAmount - a.totalAmount)
    } else {
      list.sort((a, b) => b.totalOrders - a.totalOrders)
    }
    return list.map((item, index) => ({ ...item, rank: index + 1 }))
  }, [filteredOrders, rankType])

  // 老板消费排行（有存单折扣的按折后价算，不含赠送金额）
  const bossRanking = useMemo(() => {
    const map = {}
    filteredOrders.forEach((o) => {
      if (!map[o.bossId]) {
        map[o.bossId] = {
          bossId: o.bossId,
          name: o.bossName || '未知',
          totalOrders: 0,
          totalSpent: 0,
        }
      }
      map[o.bossId].totalOrders += 1
      // 有存单扣款的用折后价，没有的用原价
      map[o.bossId].totalSpent +=
        o.depositDeduction != null
          ? parseFloat(o.depositDeduction) || 0
          : parseFloat(o.totalAmount) || 0
    })
    const list = Object.values(map)
    list.sort((a, b) => b.totalSpent - a.totalSpent)
    return list.map((item, index) => ({ ...item, rank: index + 1 }))
  }, [filteredOrders])

  // 月度趋势
  const monthlyTrend = useMemo(() => {
    const map = {}
    filteredOrders.forEach((o) => {
      const month = dayjs(o.orderTime).format('YYYY-MM')
      if (!map[month]) {
        map[month] = { month, orders: 0, amount: 0, duration: 0 }
      }
      map[month].orders += 1
      map[month].amount += parseFloat(o.totalAmount) || 0
      map[month].duration += parseFloat(o.duration) || 0
    })
    return Object.values(map).sort((a, b) => a.month.localeCompare(b.month))
  }, [filteredOrders])

  const getRankIcon = (rank) => {
    if (rank === 1)
      return (
        <CrownOutlined style={{ color: 'var(--color-gold)', fontSize: 18 }} />
      )
    if (rank === 2)
      return (
        <CrownOutlined style={{ color: 'var(--color-silver)', fontSize: 16 }} />
      )
    if (rank === 3)
      return (
        <CrownOutlined style={{ color: 'var(--color-bronze)', fontSize: 14 }} />
      )
    return <span style={{ color: 'var(--color-text-tertiary)' }}>{rank}</span>
  }

  const companionColumns = [
    {
      title: '排名',
      dataIndex: 'rank',
      key: 'rank',
      width: 70,
      align: 'center',
      render: (rank) => getRankIcon(rank),
    },
    {
      title: '陪玩',
      dataIndex: 'name',
      key: 'name',
      width: 120,
      render: (text) => <Tag color="blue">{text}</Tag>,
    },
    {
      title: '接单数',
      dataIndex: 'totalOrders',
      key: 'totalOrders',
      width: 80,
      align: 'center',
      sorter: (a, b) => a.totalOrders - b.totalOrders,
      render: (v) => <span style={{ fontWeight: 'bold' }}>{v}</span>,
    },
    {
      title: '总时长',
      dataIndex: 'totalDuration',
      key: 'totalDuration',
      width: 100,
      align: 'center',
      sorter: (a, b) => a.totalDuration - b.totalDuration,
      render: (v) => (
        <span
          style={{
            fontWeight: rankType === 'duration' ? 'bold' : 'normal',
            color: rankType === 'duration' ? 'var(--color-info)' : undefined,
          }}
        >
          {Number(v || 0).toFixed(1)}H
        </span>
      ),
    },
    {
      title: '总金额',
      dataIndex: 'totalAmount',
      key: 'totalAmount',
      width: 120,
      align: 'right',
      sorter: (a, b) => a.totalAmount - b.totalAmount,
      render: (v) => (
        <span
          style={{
            fontWeight: rankType === 'amount' ? 'bold' : 'normal',
            color: rankType === 'amount' ? 'var(--color-success)' : undefined,
          }}
        >
          ¥{fmtMoney(v)}
        </span>
      ),
    },
    {
      title: '抽成金额',
      dataIndex: 'totalCommission',
      key: 'totalCommission',
      width: 110,
      align: 'right',
      sorter: (a, b) => a.totalCommission - b.totalCommission,
      render: (v) => (
        <span style={{ color: 'var(--color-danger)' }}>¥{fmtMoney(v)}</span>
      ),
    },
    {
      title: '店铺盈利',
      dataIndex: 'storeProfit',
      key: 'storeProfit',
      width: 120,
      align: 'right',
      sorter: (a, b) => a.storeProfit - b.storeProfit,
      render: (v) => (
        <span style={{ color: 'var(--color-success)', fontWeight: 'bold' }}>
          ¥{fmtMoney(v)}
        </span>
      ),
    },
  ]

  const bossColumns = [
    {
      title: '排名',
      dataIndex: 'rank',
      key: 'rank',
      width: 70,
      align: 'center',
      render: (rank) => getRankIcon(rank),
    },
    {
      title: '老板',
      dataIndex: 'name',
      key: 'name',
      width: 120,
      render: (text) => <Tag color="green">{text}</Tag>,
    },
    {
      title: '下单数',
      dataIndex: 'totalOrders',
      key: 'totalOrders',
      width: 100,
      align: 'center',
      sorter: (a, b) => a.totalOrders - b.totalOrders,
      render: (v) => <span style={{ fontWeight: 'bold' }}>{v}</span>,
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
      dataIndex: 'totalSpent',
      key: 'totalSpent',
      width: 150,
      align: 'right',
      sorter: (a, b) => a.totalSpent - b.totalSpent,
      render: (v) => (
        <span style={{ color: 'var(--color-warning)', fontWeight: 'bold' }}>
          ¥{fmtMoney(v)}
        </span>
      ),
    },
  ]

  const monthlyColumns = [
    {
      title: '月份',
      dataIndex: 'month',
      key: 'month',
      width: 120,
    },
    {
      title: '订单数',
      dataIndex: 'orders',
      key: 'orders',
      width: 100,
      align: 'center',
      sorter: (a, b) => a.orders - b.orders,
    },
    {
      title: '总时长',
      dataIndex: 'duration',
      key: 'duration',
      width: 100,
      align: 'center',
      sorter: (a, b) => a.duration - b.duration,
      render: (v) => `${Number(v || 0).toFixed(1)}H`,
    },
    {
      title: '总金额',
      dataIndex: 'amount',
      key: 'amount',
      width: 150,
      align: 'right',
      sorter: (a, b) => a.amount - b.amount,
      render: (v) => <span style={{ fontWeight: 'bold' }}>¥{fmtMoney(v)}</span>,
    },
  ]

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Space>
          <span>日期范围：</span>
          <RangePicker
            value={dateRange}
            onChange={setDateRange}
            allowClear
            placeholder={['开始日期', '结束日期']}
          />
          {dateRange && (
            <Tag closable onClose={() => setDateRange(null)}>
              {dateRange[0]?.format('YYYY-MM-DD')} ~{' '}
              {dateRange[1]?.format('YYYY-MM-DD')}
            </Tag>
          )}
        </Space>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col span={4}>
          <Card size="small">
            <Statistic
              title="总订单"
              value={totalStats.totalOrders}
              suffix="单"
              prefix={<TeamOutlined />}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card size="small">
            <Statistic
              title="总时长"
              value={totalStats.totalDuration}
              precision={1}
              suffix="H"
              prefix={<ClockCircleOutlined />}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card size="small">
            <Statistic
              title="流水金额"
              value={totalStats.totalAmount}
              formatter={(v) => fmtMoney(v)}
              prefix={
                <>
                  <FundOutlined /> ¥
                </>
              }
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card size="small">
            <Statistic
              title="总抽成"
              value={totalStats.totalCommission}
              formatter={(v) => fmtMoney(v)}
              prefix={
                <>
                  <PayCircleOutlined /> ¥
                </>
              }
              valueStyle={{ color: 'var(--color-danger)' }}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card size="small">
            <Statistic
              title="盈利"
              value={totalStats.totalProfit}
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
        <Col span={4}>
          <Card size="small">
            <Statistic
              title="均单金额"
              value={totalStats.avgOrderAmount}
              formatter={(v) => fmtMoney(v)}
              prefix={
                <>
                  <RiseOutlined /> ¥
                </>
              }
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={14}>
          <Card
            title={
              <>
                <TrophyOutlined style={{ color: 'var(--color-gold)' }} />{' '}
                陪玩排行榜
              </>
            }
            extra={
              <Segmented
                value={rankType}
                onChange={setRankType}
                options={[
                  { value: 'duration', label: '按时长' },
                  { value: 'amount', label: '按金额' },
                  { value: 'orders', label: '按单数' },
                ]}
              />
            }
            size="small"
          >
            {companionRanking.length > 0 ? (
              <Table
                columns={companionColumns}
                dataSource={companionRanking}
                rowKey="companionId"
                pagination={false}
                size="small"
              />
            ) : (
              <Empty description="暂无数据" />
            )}
          </Card>
        </Col>
        <Col span={10}>
          <Card
            title={
              <>
                <CrownOutlined style={{ color: 'var(--color-success)' }} />{' '}
                老板消费排行
              </>
            }
            size="small"
          >
            {bossRanking.length > 0 ? (
              <Table
                columns={bossColumns}
                dataSource={bossRanking}
                rowKey="bossId"
                pagination={false}
                size="small"
              />
            ) : (
              <Empty description="暂无数据" />
            )}
          </Card>
        </Col>
      </Row>

      <Card title="月度趋势" size="small">
        {monthlyTrend.length > 0 ? (
          <Table
            columns={monthlyColumns}
            dataSource={monthlyTrend}
            rowKey="month"
            pagination={false}
            size="small"
          />
        ) : (
          <Empty description="暂无数据" />
        )}
      </Card>
    </div>
  )
}

export default DataAnalysis
