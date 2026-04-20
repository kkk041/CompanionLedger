/**
 * 格式化金额：整数不显示小数，有小数保留两位
 */
export function fmtMoney(v) {
  const n = Number(v || 0)
  return n % 1 === 0 ? n.toString() : n.toFixed(2)
}

/**
 * 计算店铺实际盈利（抽成 - 折扣差额）
 * 折扣差额由店铺承担，陪玩到手不变
 */
export function calcStoreProfit(o) {
  const comm = parseFloat(o.commissionAmount) || 0
  if (o.depositDiscount && o.depositDiscount < 100) {
    const total = parseFloat(o.totalAmount) || 0
    const discountCost = Math.round(total * (100 - o.depositDiscount)) / 100
    return Math.round((comm - discountCost) * 100) / 100
  }
  return comm
}
