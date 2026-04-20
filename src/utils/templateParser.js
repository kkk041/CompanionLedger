import dayjs from 'dayjs'

// 已知字段标签到数据键的映射
const LABEL_KEY_MAP = {
  日期: 'date',
  管理: 'manager',
  老板: 'bossName',
  陪玩: 'companionName',
  类型: 'orderType',
  起止时间: 'timeRange',
  时间: 'duration',
  时长: 'duration',
  单价: 'unitPrice',
  总计: 'totalAmount',
  抽成: 'commissionAmount',
  到手: 'actualIncome',
  直属: 'isDirect',
}

// 字段别名：模板中的标签 → 报单中可能出现的变体名称
const LABEL_ALIASES = {
  时长: ['时长', '时间', '游戏时长', '服务时长'],
  起止时间: ['起止时间', '时间段', '游戏时间'],
  日期: ['日期', '接单日期', '报单日期'],
  管理: ['管理', '管理员'],
  老板: ['老板', 'boss', '客户'],
  陪玩: ['陪玩', '陪玩员'],
  类型: ['类型', '游戏类型', '游戏'],
  单价: ['单价', '价格'],
  总计: ['总计', '总额', '合计', '总价'],
  抽成: ['抽成', '提成', '佣金'],
  到手: ['到手', '实收', '实际', '到账'],
  直属: ['直属'],
}

// 默认报单模板
export const defaultOrderTemplate = [
  { label: '日期', key: 'date', type: 'date' },
  { label: '管理', key: 'manager', type: 'text' },
  { label: '老板', key: 'bossName', type: 'text' },
  { label: '陪玩', key: 'companionName', type: 'text' },
  { label: '类型', key: 'orderType', type: 'text' },
  { label: '起止时间', key: 'timeRange', type: 'text' },
  { label: '时长', key: 'duration', type: 'number' },
  { label: '单价', key: 'unitPrice', type: 'number' },
  { label: '总计', key: 'totalAmount', type: 'number' },
  { label: '抽成', key: 'commissionAmount', type: 'number' },
  { label: '到手', key: 'actualIncome', type: 'number' },
  { label: '直属', key: 'isDirect', type: 'text' },
]

// 从标签生成数据键
export function labelToKey(label) {
  return LABEL_KEY_MAP[label] || `field_${label}`
}

// 自动检测字段类型
export function detectFieldType(label) {
  if (/起止/.test(label)) return 'text'
  if (/日期/.test(label)) return 'date'
  if (/时间/.test(label)) return 'date'
  if (/金额|价格|单价|总计|抽成|到手|收入|费用|工资/.test(label))
    return 'number'
  if (/时长|小时|数量/.test(label)) return 'number'
  return 'text'
}

// 从模板文本解析字段配置
export function parseTemplateConfig(templateText) {
  const lines = templateText
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l)
  return lines
    .map((line) => {
      const colonMatch = line.match(/^(.+?)[：:]+/)
      if (colonMatch) {
        const label = colonMatch[1].trim()
        return { label, key: labelToKey(label), type: detectFieldType(label) }
      }
      // 无冒号 → 标记类型
      const label = line.replace(/[（(][^）)]*[）)]/g, '').trim()
      if (!label) return null
      return { label, key: labelToKey(label), type: 'flag' }
    })
    .filter(Boolean)
}

// 从模板字段数组生成模板预览文本
export function generateTemplateText(template) {
  return template
    .map((f) => {
      if (f.type === 'flag') return f.label
      return `${f.label}：`
    })
    .join('\n')
}

// 灵活解析日期字符串
export function parseDate(str) {
  if (!str || str.trim() === '') return dayjs().format('YYYY-MM-DD')
  str = str.trim()

  if (/报单时间/.test(str) || str === '今天' || str === '当天') {
    return dayjs().format('YYYY-MM-DD')
  }

  // 去掉括号中的注释
  str = str.replace(/[（(][^）)]*[）)]/g, '').trim()
  if (!str) return dayjs().format('YYYY-MM-DD')

  let match
  // 完整日期: 2024年4月17日 / 2024-4-17 / 2024/4/17 / 2024.4.17
  match = str.match(/(\d{4})\s*[年\-\/\.]\s*(\d{1,2})\s*[月\-\/\.]\s*(\d{1,2})/)
  if (match) {
    const d = dayjs(
      `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`,
    )
    if (d.isValid()) return d.format('YYYY-MM-DD')
  }

  // 短日期: 4月17日 / 4-17 / 4/17 / 4.17
  match = str.match(/^(\d{1,2})\s*[月\-\/\.]\s*(\d{1,2})\s*[日号]?$/)
  if (match) {
    const year = dayjs().year()
    const d = dayjs(
      `${year}-${match[1].padStart(2, '0')}-${match[2].padStart(2, '0')}`,
    )
    if (d.isValid()) return d.format('YYYY-MM-DD')
  }

  // 短日期（非严格）: 4月17日 / 4-17 / 4/17 / 4.17（行内可能有其他文字）
  match = str.match(/(\d{1,2})\s*[月\-\/\.]\s*(\d{1,2})/)
  if (match) {
    const year = dayjs().year()
    const d = dayjs(
      `${year}-${match[1].padStart(2, '0')}-${match[2].padStart(2, '0')}`,
    )
    if (d.isValid()) return d.format('YYYY-MM-DD')
  }

  // 仅日号: 17日 / 17号
  match = str.match(/(\d{1,2})\s*[日号]/)
  if (match) {
    const d = dayjs().date(parseInt(match[1]))
    if (d.isValid()) return d.format('YYYY-MM-DD')
  }

  // 兜底: dayjs 直接解析
  const parsed = dayjs(str)
  if (parsed.isValid()) return parsed.format('YYYY-MM-DD')

  return dayjs().format('YYYY-MM-DD')
}

// 从字符串中提取数字（支持 2.5h、1h、30元、26（0.2）等格式）
export function parseNumber(str) {
  if (str == null || String(str).trim() === '') return null
  let s = String(str).trim()
  // 先去掉括号注释部分（如 "26（0.2）"→"26"）
  s = s.replace(/[（(][^）)]*[）)]/g, '').trim()
  if (!s) return null
  // 先匹配 数字+h/H 格式（如 2.5h、1H）
  const hourMatch = s.match(/(-?[\d.]+)\s*[hH小时]/)
  if (hourMatch) return parseFloat(hourMatch[1])
  // 去掉货币和单位符号后提取数字
  const cleaned = s.replace(/[¥$€￥,，\s元块]/g, '')
  const numMatch = cleaned.match(/-?[\d.]+/)
  if (numMatch) return parseFloat(numMatch[0])
  return null
}

// 解析填好的报单文本 → 数据对象
export function parseTemplateText(text, template) {
  const result = {}
  const lines = text
    .split(/\n/)
    .map((l) => l.trim())
    .filter((l) => l)

  for (const field of template) {
    const { label, key, type } = field

    if (type === 'flag') {
      const flagLine = lines.find((l) => l.includes(label))
      result[key] =
        !!flagLine && !/非|否|没有|无/.test(flagLine.replace(label, ''))
      continue
    }

    // 构建要尝试匹配的标签列表（本身 + 别名）
    const labelsToTry = [label]
    const aliases = LABEL_ALIASES[label]
    if (aliases) {
      aliases.forEach((a) => {
        if (a !== label) labelsToTry.push(a)
      })
    }
    // 反向查找：如果其他字段的别名包含本标签
    for (const [mainLabel, aliasList] of Object.entries(LABEL_ALIASES)) {
      if (aliasList.includes(label) && !labelsToTry.includes(mainLabel)) {
        // 把同组别名都加进来
        aliasList.forEach((a) => {
          if (!labelsToTry.includes(a)) labelsToTry.push(a)
        })
      }
    }

    // 查找包含该标签的行，提取冒号后面的值
    let value = ''
    let found = false
    for (const tryLabel of labelsToTry) {
      const escapedLabel = tryLabel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      for (const line of lines) {
        const regex = new RegExp(`^${escapedLabel}\\s*[：:]+\\s*(.*)`, 'i')
        const match = line.match(regex)
        if (match) {
          value = match[1].trim()
          found = true
          break
        }
      }
      if (found) break
    }

    switch (type) {
      case 'date':
        result[key] = parseDate(value)
        break
      case 'number':
        result[key] = parseNumber(value)
        break
      default:
        result[key] = value
    }
  }

  // 到手未填时，自动计算：到手 = 总计 - 抽成（陪玩拿的钱）
  if (
    result.actualIncome == null &&
    result.totalAmount != null &&
    result.commissionAmount != null
  ) {
    result.actualIncome =
      Math.round(
        ((parseFloat(result.totalAmount) || 0) -
          (parseFloat(result.commissionAmount) || 0)) *
          100,
      ) / 100
  }

  // 将未解析到的数字字段设为 0（避免表单显示 null）
  for (const field of template) {
    if (field.type === 'number' && result[field.key] == null) {
      result[field.key] = 0
    }
  }

  return result
}
