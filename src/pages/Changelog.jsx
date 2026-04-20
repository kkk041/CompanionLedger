import React from 'react'
import { Typography, Tag, Timeline } from 'antd'
import { NotificationOutlined } from '@ant-design/icons'

const { Title, Text, Paragraph } = Typography

const TAG_COLORS = {
  新功能: 'green',
  优化: 'blue',
  修复: 'orange',
  调整: 'purple',
}

const CHANGELOG = [
  {
    version: 'v1.2.0',
    date: '2026-04-19',
    items: [
      {
        tag: '新功能',
        text: '报单模板来了！可以自己设置报单要填哪些东西，结算完一键复制，再也不用手打报单了',
      },
      { tag: '新功能', text: '加了更新日志页面，每次改了什么一目了然' },
      { tag: '优化', text: '接单页面重新整理了一下，看起来更清爽' },
      { tag: '优化', text: '计费那些设置收到下面去了，常用操作更顺手' },
      { tag: '优化', text: '菜单名字改得更好懂了' },
    ],
  },
  {
    version: 'v1.1.0',
    date: '2026-04-17',
    items: [
      { tag: '新功能', text: '支持按把计费了，打一把结一把' },
      { tag: '新功能', text: '历史账单也能按「按把计费」筛选了' },
      { tag: '优化', text: '暗色和少女模式更好看了' },
      { tag: '修复', text: '结算面板偶尔闪一下的问题修好了' },
    ],
  },
  {
    version: 'v1.0.0',
    date: '2026-04-15',
    items: [
      { tag: '新功能', text: '接单计时 + 自动结算，核心功能上线' },
      { tag: '新功能', text: '今日数据、收入走势、历史账单一应俱全' },
      { tag: '新功能', text: '三套主题随便切换（明亮 / 暗色 / 少女）' },
      { tag: '新功能', text: '支持15分钟制计费' },
      { tag: '新功能', text: '抽成可以按百分比或固定金额算' },
      { tag: '新功能', text: '各种设置都能自己调（名称、主题色、计费默认值）' },
    ],
  },
]

function Changelog() {
  return (
    <div style={{ maxWidth: 800 }}>
      <Title level={3} style={{ marginBottom: 4 }}>
        更新日志
      </Title>
      <Paragraph type="secondary" style={{ marginBottom: 32 }}>
        每次版本更新都会记录在这里，方便你了解新功能和改进。
      </Paragraph>

      <Timeline
        items={CHANGELOG.map((release) => ({
          dot: <NotificationOutlined style={{ fontSize: 16 }} />,
          children: (
            <div style={{ paddingBottom: 24 }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'baseline',
                  gap: 12,
                  marginBottom: 12,
                }}
              >
                <Text strong style={{ fontSize: 20 }}>
                  {release.version}
                </Text>
                <Text type="secondary">{release.date}</Text>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {release.items.map((item, i) => (
                  <div
                    key={i}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 8,
                    }}
                  >
                    <Tag
                      color={TAG_COLORS[item.tag] || 'default'}
                      style={{ flexShrink: 0, marginRight: 0 }}
                    >
                      {item.tag}
                    </Tag>
                    <Text>{item.text}</Text>
                  </div>
                ))}
              </div>
            </div>
          ),
        }))}
      />
    </div>
  )
}

export default Changelog
