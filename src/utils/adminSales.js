const salesTimeZone = 'Asia/Manila'
const excludedStatuses = new Set(['cancelled', 'canceled', 'removed'])
const isIncluded = (status) => !excludedStatuses.has(String(status || '').trim().toLowerCase())
const amount = (value) => Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : 0

export const formatSalesCurrency = (value) => new Intl.NumberFormat('en-PH', {
  style: 'currency', currency: 'PHP', maximumFractionDigits: 2, minimumFractionDigits: 0,
}).format(amount(value))

export function salesDateKey(value = new Date()) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: salesTimeZone, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date)
  const part = (type) => parts.find((entry) => entry.type === type).value
  return `${part('year')}-${part('month')}-${part('day')}`
}

export function addSalesDays(key, offset) {
  const date = new Date(`${key}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + offset)
  return date.toISOString().slice(0, 10)
}

export function shiftSalesMonth(month, offset) {
  const date = new Date(`${month}-01T00:00:00Z`)
  date.setUTCMonth(date.getUTCMonth() + offset)
  return date.toISOString().slice(0, 7)
}

export function formatSalesDate(key, options = { month: 'short', day: 'numeric', year: 'numeric' }) {
  return new Intl.DateTimeFormat('en-PH', { ...options, timeZone: 'UTC' }).format(new Date(`${key}T00:00:00Z`))
}

export const formatSalesMonth = (month) => formatSalesDate(`${month}-01`, { month: 'long', year: 'numeric' })

export function salesCalendarDays(month) {
  const first = `${month}-01`
  const start = addSalesDays(first, -new Date(`${first}T00:00:00Z`).getUTCDay())
  return Array.from({ length: 42 }, (_, index) => {
    const key = addSalesDays(start, index)
    return { key, day: Number(key.slice(8)), inMonth: key.startsWith(month) }
  })
}

export function summarizeSales(orders) {
  return orders.reduce((summary, order) => ({
    count: summary.count + 1,
    revenue: summary.revenue + order.revenue,
    units: summary.units + order.units,
  }), { count: 0, revenue: 0, units: 0 })
}

export function rankSalesProducts(orders) {
  const products = new Map()
  orders.forEach((order) => order.activeItems.forEach((item) => {
    const name = String(item.name || item.productName || item.productId || 'Unnamed product').trim()
    const id = String(item.productId || name.toLowerCase())
    const sold = amount(item.quantity)
    if (!sold) return
    const existing = products.get(id) || { id, name, sold: 0, revenue: 0 }
    products.set(id, { ...existing, sold: existing.sold + sold, revenue: existing.revenue + amount(item.price) * sold })
  }))
  return Array.from(products.values()).sort((a, b) => b.sold - a.sold || b.revenue - a.revenue || a.name.localeCompare(b.name))
}

export function buildSalesAnalytics(rawOrders = [], today = salesDateKey()) {
  const orders = rawOrders.filter((order) => isIncluded(order.status)).map((order) => {
    const activeItems = (Array.isArray(order.items) ? order.items : []).filter((item) => isIncluded(item.trackingStatus || order.status))
    return {
      ...order,
      dateKey: salesDateKey(order.createdAt || null),
      // Preserve the existing report's stored order totals and exclusion rules.
      revenue: amount(order.total),
      units: activeItems.reduce((total, item) => total + amount(item.quantity), 0),
      activeItems,
    }
  }).sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))

  const daily = new Map()
  orders.forEach((order) => {
    if (!order.dateKey) return
    const current = daily.get(order.dateKey) || { count: 0, revenue: 0, units: 0 }
    daily.set(order.dateKey, { count: current.count + 1, revenue: current.revenue + order.revenue, units: current.units + order.units })
  })
  const week = Array.from({ length: 7 }, (_, index) => {
    const key = addSalesDays(today, index - 6)
    return { key, label: formatSalesDate(key, { weekday: 'short' }), total: daily.get(key)?.revenue || 0 }
  })
  const weekKeys = new Set(week.map((day) => day.key))
  const weeklyTotal = week.reduce((total, day) => total + day.total, 0)
  return {
    orders, daily, week, weeklyTotal, averageDaily: weeklyTotal / 7,
    summary: summarizeSales(orders),
    mostSoldProduct: rankSalesProducts(orders.filter((order) => weekKeys.has(order.dateKey)))[0],
  }
}
