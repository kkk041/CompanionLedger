import React, { useState, useEffect, useMemo } from 'react'
import { Card, Row, Col, Segmented, Empty, Avatar, Tooltip, Spin } from 'antd'
import {
  CrownOutlined,
  TrophyOutlined,
  ClockCircleOutlined,
  DollarOutlined,
  ThunderboltOutlined,
  UserOutlined,
  FireOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import isoWeek from 'dayjs/plugin/isoWeek'
import { getAll, DATA_FILES } from '../services/storage'
import { fmtMoney, calcStoreProfit } from '../utils/format'

dayjs.extend(isoWeek)

// 时间范围枚举
const TIME_RANGES = [
  { label: '今日', value: 'today' },
  { label: '本周', value: 'week' },
  { label: '本月', value: 'month' },
]

// 奖牌配置
const MEDALS = [
  {
    icon: '🥇',
    label: '冠军',
    color: '#faad14',
    glow: 'rgba(250, 173, 20, 0.6)',
    bg: 'linear-gradient(135deg, #fff9e6 0%, #fff1b8 50%, #ffe58f 100%)',
    border: '#ffd666',
    rank: 1,
  },
  {
    icon: '🥈',
    label: '亚军',
    color: '#8c8c8c',
    glow: 'rgba(140, 140, 140, 0.5)',
    bg: 'linear-gradient(135deg, #fafafa 0%, #f0f0f0 50%, #e8e8e8 100%)',
    border: '#d9d9d9',
    rank: 2,
  },
  {
    icon: '🥉',
    label: '季军',
    color: '#d48806',
    glow: 'rgba(212, 136, 6, 0.5)',
    bg: 'linear-gradient(135deg, #fff7e6 0%, #ffe7ba 50%, #ffd591 100%)',
    border: '#ffc069',
    rank: 3,
  },
]

// 根据时间范围过滤订单
function filterByTime(orders, range) {
  const now = dayjs()
  return orders.filter((o) => {
    const t = dayjs(o.orderTime)
    if (!t.isValid()) return false
    switch (range) {
      case 'today':
        return t.isSame(now, 'day')
      case 'week':
        return t.isoWeek() === now.isoWeek() && t.year() === now.year()
      case 'month':
        return t.isSame(now, 'month')
      default:
        return true
    }
  })
}

// 汇总陪玩数据
function aggregateCompanionData(orders) {
  const map = {}
  orders.forEach((o) => {
    const key = o.companionId || o.companionName
    if (!key) return
    if (!map[key]) {
      map[key] = {
        id: key,
        name: o.companionName,
        totalAmount: 0,
        totalDuration: 0,
        orderCount: 0,
        profit: 0,
      }
    }
    map[key].totalAmount += parseFloat(o.totalAmount) || 0
    map[key].totalDuration += parseFloat(o.duration) || 0
    map[key].orderCount += 1
    map[key].profit += calcStoreProfit(o)
  })
  return Object.values(map)
}

// 汇总老板数据
function aggregateBossData(orders) {
  const map = {}
  orders.forEach((o) => {
    const key = o.bossId || o.bossName
    if (!key) return
    if (!map[key]) {
      map[key] = {
        id: key,
        name: o.bossName,
        totalSpend: 0,
        orderCount: 0,
        totalDuration: 0,
      }
    }
    // 存单折扣按折后价
    const amount = parseFloat(o.totalAmount) || 0
    if (o.depositDiscount && o.depositDiscount < 100) {
      map[key].totalSpend += Math.round(amount * o.depositDiscount) / 100
    } else {
      map[key].totalSpend += amount
    }
    map[key].orderCount += 1
    map[key].totalDuration += parseFloat(o.duration) || 0
  })
  return Object.values(map)
}

// 排行卡片组件
function RankCard({ title, icon, data, valueKey, unit, formatFn, colorVar }) {
  const sorted = useMemo(
    () => [...data].sort((a, b) => b[valueKey] - a[valueKey]).slice(0, 10),
    [data, valueKey],
  )

  return (
    <Card
      className="ranking-card"
      title={
        <span className="ranking-card-title">
          {icon} {title}
        </span>
      }
      size="small"
    >
      {sorted.length === 0 ? (
        <Empty description="暂无数据" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      ) : (
        <div className="ranking-list">
          {sorted.map((item, idx) => {
            const medal = MEDALS[idx]
            const isMedal = idx < 3
            return (
              <div
                key={item.id}
                className={`ranking-item ${isMedal ? `ranking-medal ranking-medal-${idx + 1}` : ''}`}
              >
                <div className="ranking-pos">
                  {isMedal ? (
                    <span className={`medal-icon medal-${idx + 1}`}>
                      {medal.icon}
                    </span>
                  ) : (
                    <span className="ranking-num">{idx + 1}</span>
                  )}
                </div>
                <div className="ranking-avatar">
                  <Avatar
                    size={isMedal ? 38 : 30}
                    style={{
                      background: isMedal
                        ? medal.color
                        : 'var(--color-info, #1677ff)',
                      fontSize: isMedal ? 16 : 13,
                    }}
                  >
                    {item.name?.charAt(0) || '?'}
                  </Avatar>
                </div>
                <div className="ranking-info">
                  <span className="ranking-name">{item.name}</span>
                  {isMedal && (
                    <span
                      className="ranking-badge"
                      style={{ color: medal.color }}
                    >
                      {medal.label}
                    </span>
                  )}
                </div>
                <div className="ranking-value">
                  <span className="ranking-number">
                    {formatFn
                      ? formatFn(item[valueKey])
                      : item[valueKey].toFixed(1)}
                  </span>
                  <span className="ranking-unit">{unit}</span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </Card>
  )
}

function RankingBoard() {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(false)
  const [timeRange, setTimeRange] = useState('today')
  const [category, setCategory] = useState('companion')

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    const ordersData = await getAll(DATA_FILES.ORDERS)
    setOrders(ordersData)
    setLoading(false)
  }

  // 按时间过滤
  const filtered = useMemo(
    () => filterByTime(orders, timeRange),
    [orders, timeRange],
  )

  // 陪玩汇总
  const companionData = useMemo(
    () => aggregateCompanionData(filtered),
    [filtered],
  )

  // 老板汇总
  const bossData = useMemo(() => aggregateBossData(filtered), [filtered])

  // 统计概览
  const overview = useMemo(() => {
    const total = filtered.length
    const revenue = filtered.reduce(
      (s, o) => s + (parseFloat(o.totalAmount) || 0),
      0,
    )
    const hours = filtered.reduce(
      (s, o) => s + (parseFloat(o.duration) || 0),
      0,
    )
    const profit = filtered.reduce((s, o) => s + calcStoreProfit(o), 0)
    return { total, revenue, hours, profit }
  }, [filtered])

  const timeLabel =
    timeRange === 'today' ? '今日' : timeRange === 'week' ? '本周' : '本月'

  return (
    <Spin spinning={loading}>
      <div className="ranking-board">
        {/* 顶部控制栏 */}
        <div className="ranking-header">
          <div className="ranking-header-left">
            <TrophyOutlined className="ranking-header-icon" />
            <h2 className="ranking-title">排行榜</h2>
          </div>
          <div className="ranking-header-right">
            <Segmented
              options={[
                { label: '陪玩榜', value: 'companion' },
                { label: '老板榜', value: 'boss' },
              ]}
              value={category}
              onChange={setCategory}
            />
            <Segmented
              options={TIME_RANGES}
              value={timeRange}
              onChange={setTimeRange}
            />
          </div>
        </div>

        {/* 概览统计条 */}
        <div className="ranking-overview" key={`overview-${timeRange}`}>
          <div className="overview-item">
            <ThunderboltOutlined />
            <span className="overview-label">{timeLabel}订单</span>
            <span className="overview-value">{overview.total}</span>
          </div>
          <div className="overview-divider" />
          <div className="overview-item">
            <DollarOutlined />
            <span className="overview-label">{timeLabel}流水</span>
            <span className="overview-value">
              ¥{fmtMoney(overview.revenue)}
            </span>
          </div>
          <div className="overview-divider" />
          <div className="overview-item">
            <ClockCircleOutlined />
            <span className="overview-label">{timeLabel}时长</span>
            <span className="overview-value">{overview.hours.toFixed(1)}h</span>
          </div>
          <div className="overview-divider" />
          <div className="overview-item">
            <FireOutlined />
            <span className="overview-label">{timeLabel}盈利</span>
            <span className="overview-value">¥{fmtMoney(overview.profit)}</span>
          </div>
        </div>

        {/* 陪玩排行 */}
        {category === 'companion' && (
          <Row
            gutter={[16, 16]}
            key={`companion-${timeRange}`}
            className="ranking-row-enter"
          >
            <Col xs={24} lg={8}>
              <RankCard
                title="接单金额榜"
                icon={
                  <DollarOutlined style={{ color: 'var(--color-warning)' }} />
                }
                data={companionData}
                valueKey="totalAmount"
                unit="元"
                formatFn={fmtMoney}
              />
            </Col>
            <Col xs={24} lg={8}>
              <RankCard
                title="接单时长榜"
                icon={
                  <ClockCircleOutlined style={{ color: 'var(--color-info)' }} />
                }
                data={companionData}
                valueKey="totalDuration"
                unit="小时"
              />
            </Col>
            <Col xs={24} lg={8}>
              <RankCard
                title="接单数量榜"
                icon={
                  <ThunderboltOutlined
                    style={{ color: 'var(--color-success)' }}
                  />
                }
                data={companionData}
                valueKey="orderCount"
                unit="单"
                formatFn={(v) => v.toString()}
              />
            </Col>
          </Row>
        )}

        {/* 老板排行 */}
        {category === 'boss' && (
          <Row
            gutter={[16, 16]}
            key={`boss-${timeRange}`}
            className="ranking-row-enter"
          >
            <Col xs={24} lg={8}>
              <RankCard
                title="消费金额榜"
                icon={
                  <DollarOutlined style={{ color: 'var(--color-warning)' }} />
                }
                data={bossData}
                valueKey="totalSpend"
                unit="元"
                formatFn={fmtMoney}
              />
            </Col>
            <Col xs={24} lg={8}>
              <RankCard
                title="下单次数榜"
                icon={
                  <ThunderboltOutlined
                    style={{ color: 'var(--color-success)' }}
                  />
                }
                data={bossData}
                valueKey="orderCount"
                unit="单"
                formatFn={(v) => v.toString()}
              />
            </Col>
            <Col xs={24} lg={8}>
              <RankCard
                title="消费时长榜"
                icon={
                  <ClockCircleOutlined style={{ color: 'var(--color-info)' }} />
                }
                data={bossData}
                valueKey="totalDuration"
                unit="小时"
              />
            </Col>
          </Row>
        )}
      </div>
    </Spin>
  )
}

export default RankingBoard
