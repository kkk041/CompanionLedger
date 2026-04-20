import React, { useState, useEffect, useMemo } from 'react'
import {
  Card,
  Form,
  Input,
  InputNumber,
  Switch,
  Select,
  Button,
  message,
  Space,
  Row,
  Col,
  Typography,
  Table,
  Collapse,
  ColorPicker,
  Tooltip,
  Upload,
  Avatar,
  Modal,
} from 'antd'
import {
  SkinOutlined,
  SaveOutlined,
  UndoOutlined,
  LayoutOutlined,
  CopyOutlined,
  AppstoreOutlined,
  UploadOutlined,
  DeleteOutlined,
  ExclamationCircleOutlined,
  WarningOutlined,
} from '@ant-design/icons'
import { useLocation } from 'react-router-dom'
import {
  useTheme,
  defaultSettings,
  DEFAULT_THEME_COLORS,
} from '../contexts/ThemeContext'
import {
  defaultOrderTemplate,
  parseTemplateConfig,
  generateTemplateText,
} from '../utils/templateParser'
import { writeData, DATA_FILES } from '../services/storage'

const { Text } = Typography

const TYPE_OPTIONS = [
  { value: 'text', label: '文字（如姓名、备注）' },
  { value: 'date', label: '日期（如4月17日）' },
  { value: 'number', label: '数字（如金额、时长）' },
  { value: 'flag', label: '标记（无需填值，出现即生效）' },
]

function SystemSettings() {
  const { settings, updateSettings, themes } = useTheme()
  const [form] = Form.useForm()
  const location = useLocation()

  // 模板展开状态：从接单记录跳转时自动展开
  const [templateActiveKey, setTemplateActiveKey] = useState(
    location.state?.expandTemplate ? ['template'] : [],
  )

  // 离开页面时自动收起（路由变化时 location.state 会清空）
  useEffect(() => {
    if (location.state?.expandTemplate) {
      setTemplateActiveKey(['template'])
    } else {
      setTemplateActiveKey([])
    }
  }, [location.state])

  // 模板相关状态
  const [templateText, setTemplateText] = useState('')
  const [typeOverrides, setTypeOverrides] = useState({})

  useEffect(() => {
    const tpl = settings.orderTemplate || defaultOrderTemplate
    setTemplateText(generateTemplateText(tpl))
    // 初始化类型覆盖
    const overrides = {}
    tpl.forEach((f) => {
      overrides[f.label] = f.type
    })
    setTypeOverrides(overrides)
  }, [])

  // 从模板文本实时检测字段
  const detectedFields = useMemo(() => {
    const fields = parseTemplateConfig(templateText)
    return fields.map((f) => ({
      ...f,
      type: typeOverrides[f.label] || f.type,
    }))
  }, [templateText, typeOverrides])

  const handleFieldTypeChange = (label, newType) => {
    setTypeOverrides((prev) => ({ ...prev, [label]: newType }))
  }

  const handleSaveTemplate = async () => {
    await updateSettings({ orderTemplate: detectedFields })
    message.success('模板已保存')
  }

  const handleResetTemplate = () => {
    setTemplateText(generateTemplateText(defaultOrderTemplate))
    const overrides = {}
    defaultOrderTemplate.forEach((f) => {
      overrides[f.label] = f.type
    })
    setTypeOverrides(overrides)
  }

  // 模板字段预览表格列
  const fieldColumns = [
    {
      title: '字段名',
      dataIndex: 'label',
      key: 'label',
      width: 120,
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      width: 200,
      render: (type, record) => (
        <Select
          value={type}
          size="small"
          style={{ width: 180 }}
          onChange={(val) => handleFieldTypeChange(record.label, val)}
          options={TYPE_OPTIONS}
        />
      ),
    },
  ]

  const handleSave = async () => {
    const values = form.getFieldsValue()
    await updateSettings(values)
    message.success('设置已保存')
  }

  const handleReset = () => {
    form.setFieldsValue(defaultSettings)
    updateSettings(defaultSettings)
    handleResetTemplate()
    message.success('已恢复默认设置')
  }

  const themeOptions = Object.values(themes).map((t) => ({
    value: t.key,
    label: (
      <Space>
        <span
          style={{
            display: 'inline-block',
            width: 14,
            height: 14,
            borderRadius: '50%',
            background: t.color,
            verticalAlign: 'middle',
          }}
        />
        {t.name}
      </Space>
    ),
  }))

  // 主题色管理
  const currentColors = settings.themeColors || {}
  const getColor = (key) => currentColors[key] || DEFAULT_THEME_COLORS[key]

  const handleColorChange = async (themeKey, color) => {
    const hex = typeof color === 'string' ? color : color.toHexString()
    const newColors = { ...currentColors, [themeKey]: hex }
    await updateSettings({ themeColors: newColors })
  }

  const handleResetColor = async (themeKey) => {
    const newColors = { ...currentColors }
    delete newColors[themeKey]
    await updateSettings({ themeColors: newColors })
    message.success('已恢复默认色')
  }

  // 清除所有业务数据
  const handleClearData = () => {
    Modal.confirm({
      title: '确认清除所有数据？',
      icon: <ExclamationCircleOutlined />,
      content: (
        <div>
          <p style={{ color: 'var(--color-danger)', fontWeight: 'bold' }}>
            此操作将永久删除以下所有数据：
          </p>
          <ul style={{ paddingLeft: 20, color: 'var(--color-text-secondary)' }}>
            <li>所有订单记录</li>
            <li>所有陪玩信息</li>
            <li>所有老板信息</li>
            <li>所有存单记录</li>
          </ul>
          <p style={{ color: 'var(--color-text-tertiary)', fontSize: 12 }}>
            系统设置（模板、主题等）将保留不受影响。
          </p>
        </div>
      ),
      okText: '确认清除',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: () => {
        return new Promise((resolve) => {
          // 二次确认
          Modal.confirm({
            title: '最终确认',
            icon: <WarningOutlined style={{ color: 'var(--color-danger)' }} />,
            content: (
              <div>
                <p
                  style={{
                    color: 'var(--color-danger)',
                    fontWeight: 'bold',
                    fontSize: 16,
                  }}
                >
                  数据删除后无法恢复！
                </p>
                <p>请确认您已做好数据备份或确实需要清除所有数据。</p>
              </div>
            ),
            okText: '立即清除',
            okButtonProps: { danger: true },
            cancelText: '我再想想',
            onOk: async () => {
              try {
                await writeData(DATA_FILES.ORDERS, [])
                await writeData(DATA_FILES.COMPANIONS, [])
                await writeData(DATA_FILES.BOSSES, [])
                await writeData(DATA_FILES.DEPOSITS, [])
                message.success('所有业务数据已清除')
              } catch (err) {
                message.error('清除数据失败：' + err.message)
              }
              resolve()
            },
            onCancel: () => {
              resolve()
            },
          })
        })
      },
    })
  }

  return (
    <div>
      <Form
        form={form}
        layout="vertical"
        initialValues={settings}
        style={{ maxWidth: 900 }}
      >
        {/* 报单模板配置 */}
        <Collapse
          activeKey={templateActiveKey}
          onChange={(keys) => setTemplateActiveKey(keys)}
          style={{ marginBottom: 16 }}
          items={[
            {
              key: 'template',
              label: (
                <Space>
                  <CopyOutlined />
                  <span>报单模板配置</span>
                </Space>
              ),
              children: (
                <Row gutter={24}>
                  <Col span={10}>
                    <div style={{ marginBottom: 8 }}>
                      <Text strong>模板文本</Text>
                      <br />
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        每行写一个字段名加冒号，如「老板：」「陪玩：」，系统会自动识别。
                      </Text>
                    </div>
                    <Input.TextArea
                      rows={14}
                      value={templateText}
                      onChange={(e) => setTemplateText(e.target.value)}
                      style={{ fontFamily: 'monospace' }}
                    />
                    <Space style={{ marginTop: 12 }}>
                      <Button
                        type="primary"
                        size="small"
                        onClick={handleSaveTemplate}
                      >
                        保存模板
                      </Button>
                      <Button size="small" onClick={handleResetTemplate}>
                        恢复默认
                      </Button>
                    </Space>
                  </Col>
                  <Col span={14}>
                    <div style={{ marginBottom: 8 }}>
                      <Text strong>
                        识别的字段（{detectedFields.length}个）
                      </Text>
                    </div>
                    <Table
                      dataSource={detectedFields}
                      columns={fieldColumns}
                      pagination={false}
                      size="small"
                      rowKey="label"
                    />
                  </Col>
                </Row>
              ),
            },
          ]}
        />

        {/* 品牌设置 */}
        <Card
          size="small"
          title={
            <Space>
              <AppstoreOutlined />
              <span>品牌设置</span>
            </Space>
          }
          style={{ marginBottom: 16 }}
        >
          <Row gutter={24} align="middle">
            <Col span={4}>
              <div style={{ textAlign: 'center' }}>
                <Text
                  type="secondary"
                  style={{ fontSize: 12, display: 'block', marginBottom: 8 }}
                >
                  应用图标
                </Text>
                <Avatar
                  src={settings.appIcon || '/icon.png'}
                  size={56}
                  shape="square"
                  style={{
                    cursor: 'pointer',
                    background: 'var(--color-bg-neutral)',
                  }}
                />
                <div style={{ marginTop: 8 }}>
                  <Space size={4}>
                    <Upload
                      accept="image/png,image/jpeg,image/svg+xml,image/webp"
                      showUploadList={false}
                      beforeUpload={(file) => {
                        if (file.size > 512 * 1024) {
                          message.error('图标文件不能超过 512KB')
                          return false
                        }
                        const reader = new FileReader()
                        reader.onload = async (e) => {
                          const dataUrl = e.target.result
                          await updateSettings({ appIcon: dataUrl })
                          message.success('图标已更新')
                          Modal.confirm({
                            title: '重启应用',
                            content:
                              '任务栏图标需要重启应用后才能生效，是否立即重启？',
                            okText: '立即重启',
                            cancelText: '稍后再说',
                            centered: true,
                            onOk: () => {
                              window.electronAPI?.appRelaunch()
                            },
                          })
                        }
                        reader.readAsDataURL(file)
                        return false
                      }}
                    >
                      <Button size="small" icon={<UploadOutlined />}>
                        上传
                      </Button>
                    </Upload>
                    {settings.appIcon && (
                      <Button
                        size="small"
                        icon={<DeleteOutlined />}
                        onClick={async () => {
                          await updateSettings({ appIcon: '' })
                          message.success('已恢复默认图标')
                        }}
                      />
                    )}
                  </Space>
                </div>
              </div>
            </Col>
            <Col span={20}>
              <Form.Item name="appTitle" label="应用标题">
                <Input placeholder="陪玩店管理" maxLength={20} showCount />
              </Form.Item>
              <Text type="secondary" style={{ fontSize: 12 }}>
                修改图标会同时更新侧边栏和系统任务栏显示的图标，修改标题会更新侧边栏和窗口标题
              </Text>
            </Col>
          </Row>
        </Card>

        {/* 主题设置 */}
        <Card
          size="small"
          title={
            <Space>
              <SkinOutlined />
              <span>外观设置</span>
            </Space>
          }
          style={{ marginBottom: 16 }}
        >
          <Row gutter={24}>
            <Col span={12}>
              <Form.Item name="theme" label="界面主题">
                <Select options={themeOptions} />
              </Form.Item>
            </Col>
          </Row>

          <div style={{ marginTop: 4 }}>
            <Text strong style={{ display: 'block', marginBottom: 12 }}>
              主题色调整
            </Text>
            <Row gutter={[24, 12]}>
              {[
                { key: 'light', label: '明亮主题' },
                { key: 'dark', label: '暗色主题' },
                { key: 'pink', label: '少女主题' },
              ].map((item) => (
                <Col span={8} key={item.key}>
                  <div
                    style={{
                      padding: '12px',
                      borderRadius: 8,
                      border: '1px solid var(--color-border-subtle)',
                      textAlign: 'center',
                    }}
                  >
                    <Text
                      type="secondary"
                      style={{
                        fontSize: 12,
                        display: 'block',
                        marginBottom: 8,
                      }}
                    >
                      {item.label}
                    </Text>
                    <Space>
                      <ColorPicker
                        value={getColor(item.key)}
                        onChange={(c) => handleColorChange(item.key, c)}
                        size="small"
                        presets={[
                          {
                            label: '推荐',
                            colors: [
                              DEFAULT_THEME_COLORS[item.key],
                              '#1677ff',
                              '#13c2c2',
                              '#52c41a',
                              '#fa8c16',
                              '#f5222d',
                              '#722ed1',
                              '#eb2f96',
                              '#ff4fa3',
                              '#2f54eb',
                            ],
                          },
                        ]}
                      />
                      <Tooltip title="恢复默认色">
                        <Button
                          type="text"
                          size="small"
                          icon={<UndoOutlined />}
                          onClick={() => handleResetColor(item.key)}
                          style={{ color: 'var(--color-text-tertiary)' }}
                        />
                      </Tooltip>
                    </Space>
                    <div
                      style={{
                        marginTop: 8,
                        fontSize: 11,
                        color: 'var(--color-text-tertiary)',
                        fontFamily: 'monospace',
                      }}
                    >
                      {getColor(item.key)}
                    </div>
                  </div>
                </Col>
              ))}
            </Row>
          </div>
        </Card>

        {/* 表格显示 */}
        <Card
          size="small"
          title={
            <Space>
              <LayoutOutlined />
              <span>表格显示</span>
            </Space>
          }
          style={{ marginBottom: 16 }}
        >
          <Row gutter={24}>
            <Col span={8}>
              <Form.Item name="pageSize" label="每页显示条数">
                <Select
                  options={[
                    { value: 10, label: '10 条/页' },
                    { value: 15, label: '15 条/页' },
                    { value: 20, label: '20 条/页' },
                    { value: 30, label: '30 条/页' },
                    { value: 50, label: '50 条/页' },
                  ]}
                />
              </Form.Item>
            </Col>
          </Row>
        </Card>

        {/* 操作按钮 */}
        <Space size="middle">
          <Button
            type="primary"
            icon={<SaveOutlined />}
            size="large"
            onClick={handleSave}
          >
            保存设置
          </Button>
          <Button icon={<UndoOutlined />} size="large" onClick={handleReset}>
            恢复默认
          </Button>
        </Space>
      </Form>

      {/* 危险区域 */}
      <Card
        title={
          <span style={{ color: 'var(--color-danger)' }}>
            <WarningOutlined /> 危险操作
          </span>
        }
        size="small"
        style={{
          marginTop: 24,
          borderColor: 'var(--color-border-danger)',
        }}
        styles={{
          header: {
            background: 'var(--color-bg-danger)',
            borderBottom: '1px solid var(--color-border-danger)',
          },
        }}
      >
        <Row align="middle" justify="space-between">
          <Col>
            <div>
              <Text strong>清除所有业务数据</Text>
            </div>
            <Text type="secondary" style={{ fontSize: 12 }}>
              删除所有订单、陪玩、老板、存单记录，系统设置保留。适用于管理员交接或离职时清除数据。
            </Text>
          </Col>
          <Col>
            <Button danger icon={<DeleteOutlined />} onClick={handleClearData}>
              清除数据
            </Button>
          </Col>
        </Row>
      </Card>
    </div>
  )
}

export default SystemSettings
