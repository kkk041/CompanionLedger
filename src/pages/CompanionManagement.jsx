import React, { useState, useEffect } from 'react'
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
} from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons'
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

function CompanionManagement() {
  const { settings } = useTheme()
  const [companions, setCompanions] = useState([])
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(false)
  const [modalVisible, setModalVisible] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form] = Form.useForm()

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    const [companionsData, ordersData] = await Promise.all([
      getAll(DATA_FILES.COMPANIONS),
      getAll(DATA_FILES.ORDERS),
    ])
    setCompanions(companionsData)
    setOrders(ordersData)
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
    // 检查是否有关联订单
    const hasOrders = orders.some((o) => o.companionId === id)
    if (hasOrders) {
      message.warning('该陪玩有关联的接单记录，无法删除')
      return
    }
    await deleteRecord(DATA_FILES.COMPANIONS, id)
    message.success('删除成功')
    loadData()
  }

  const handleSubmit = async () => {
    const values = await form.validateFields()

    if (editing) {
      await updateRecord(DATA_FILES.COMPANIONS, editing.id, values)
      // 如果姓名变更，同步更新所有关联订单
      if (values.name !== editing.name) {
        const allOrders = await getAll(DATA_FILES.ORDERS)
        for (const order of allOrders) {
          if (
            order.companionId === editing.id ||
            order.companionName === editing.name
          ) {
            await updateRecord(DATA_FILES.ORDERS, order.id, {
              companionName: values.name,
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
      await addRecord(DATA_FILES.COMPANIONS, record)
      message.success('添加成功')
    }

    setModalVisible(false)
    loadData()
  }

  // 计算每个陪玩的接单统计
  const getCompanionStats = (companionId, companionName) => {
    const companionOrders = orders.filter(
      (o) =>
        o.companionId === companionId ||
        (companionName && o.companionName === companionName),
    )
    const totalOrders = companionOrders.length
    const totalDuration = companionOrders.reduce(
      (sum, o) => sum + (parseFloat(o.duration) || 0),
      0,
    )
    const totalIncome = companionOrders.reduce(
      (sum, o) => sum + (parseFloat(o.totalAmount) || 0),
      0,
    )
    return { totalOrders, totalDuration, totalIncome }
  }

  const columns = [
    {
      title: '姓名',
      dataIndex: 'name',
      key: 'name',
      render: (text) => (
        <Tag color="blue" style={{ fontSize: 14 }}>
          {text}
        </Tag>
      ),
    },
    {
      title: '联系方式',
      dataIndex: 'contact',
      key: 'contact',
    },
    {
      title: '接单数',
      key: 'totalOrders',
      align: 'center',
      sorter: (a, b) =>
        getCompanionStats(a.id, a.name).totalOrders -
        getCompanionStats(b.id, b.name).totalOrders,
      render: (_, record) => {
        const stats = getCompanionStats(record.id, record.name)
        return <span style={{ fontWeight: 'bold' }}>{stats.totalOrders}</span>
      },
    },
    {
      title: '总时长(h)',
      key: 'totalDuration',
      align: 'center',
      sorter: (a, b) =>
        getCompanionStats(a.id, a.name).totalDuration -
        getCompanionStats(b.id, b.name).totalDuration,
      render: (_, record) => {
        const stats = getCompanionStats(record.id, record.name)
        return Number(stats.totalDuration || 0).toFixed(1)
      },
    },
    {
      title: '总金额',
      key: 'totalIncome',
      align: 'right',
      sorter: (a, b) =>
        getCompanionStats(a.id, a.name).totalIncome -
        getCompanionStats(b.id, b.name).totalIncome,
      render: (_, record) => {
        const stats = getCompanionStats(record.id, record.name)
        return (
          <span style={{ color: 'var(--color-success)', fontWeight: 'bold' }}>
            ¥{fmtMoney(stats.totalIncome)}
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
      title: '添加时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
    },
    {
      title: '操作',
      key: 'action',
      width: 100,
      render: (_, record) => (
        <Space>
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

  return (
    <div>
      <Card
        title={`陪玩管理 (共 ${companions.length} 人)`}
        size="small"
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
            添加陪玩
          </Button>
        }
      >
        <Table
          columns={columns}
          dataSource={companions}
          rowKey="id"
          loading={loading}
          pagination={{
            pageSize: settings.pageSize || 15,
            showTotal: (total) => `共 ${total} 条`,
          }}
          size="small"
        />
      </Card>

      <Modal
        title={editing ? '编辑陪玩' : '添加陪玩'}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            name="name"
            label="姓名"
            rules={[{ required: true, message: '请输入姓名' }]}
          >
            <Input placeholder="输入陪玩姓名" />
          </Form.Item>
          <Form.Item name="contact" label="联系方式">
            <Input placeholder="手机号/微信号等" />
          </Form.Item>
          <Form.Item name="remark" label="备注">
            <Input.TextArea rows={2} placeholder="备注信息" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default CompanionManagement
