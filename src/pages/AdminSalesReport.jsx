import { useEffect, useMemo, useState } from 'react'
import { api } from '../lib/api.js'

function AdminSalesReport() {
  const [summary, setSummary] = useState({ count: 0, revenue: 0 })
  const [status, setStatus] = useState({ loading: true, error: '' })
  const [orders, setOrders] = useState([])

  useEffect(() => {
    const load = async () => {
      try {
        setStatus({ loading: true, error: '' })
        const [data, allOrders] = await Promise.all([api.adminSales(), api.orders()])
        setSummary(data)
        setOrders(allOrders)
        setStatus({ loading: false, error: '' })
      } catch (error) {
        setStatus({ loading: false, error: error.message })
      }
    }
    load()
  }, [])

  const chartData = useMemo(() => {
    const days = []
    for (let i = 6; i >= 0; i -= 1) {
      const date = new Date()
      date.setDate(date.getDate() - i)
      const key = date.toLocaleDateString()
      const label = date.toLocaleDateString(undefined, { weekday: 'short' })
      days.push({ key, label, total: 0 })
    }
    orders.forEach((order) => {
      const day = order.createdAt ? new Date(order.createdAt).toLocaleDateString() : ''
      const item = days.find((d) => d.key === day)
      if (item) item.total += order.total || 0
    })
    return days
  }, [orders])

  const points = useMemo(() => {
    if (chartData.length === 0) return ''
    const maxRaw = Math.max(...chartData.map((d) => d.total), 100)
    const max = Math.ceil(maxRaw / 100) * 100
    return chartData
      .map((d, index) => {
        const x = 40 + (index / (chartData.length - 1)) * 260
        const y = 130 - (d.total / max) * 90
        return `${x},${y}`
      })
      .join(' ')
  }, [chartData])

  const weeklyTotal = chartData.reduce((sum, day) => sum + day.total, 0)
  const averageDaily = chartData.length ? Math.round(weeklyTotal / chartData.length) : 0
  const maxAxis = Math.max(100, Math.ceil(Math.max(...chartData.map((d) => d.total), 100) / 100) * 100)

  return (
    <section className="grid" style={{ gap: '24px' }}>
      <div>
        <h1 className="section-title">Sales Report</h1>
        <p className="section-subtitle">COD trends and inventory impact.</p>
      </div>

      {status.loading && (
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div className="loader" />
          Loading sales summary...
        </div>
      )}
      {status.error && <div className="card">Error: {status.error}</div>}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 className="section-title" style={{ fontSize: '22px' }}>
            Sales Summary
          </h2>
          <button className="button secondary" type="button" onClick={() => window.print()}>
            Print PDF
          </button>
        </div>
        <div className="card" style={{ marginTop: '16px' }}>
          <div className="tag">Sales per day</div>
          <svg viewBox="0 0 320 180" width="100%" height="180">
            <line x1="40" y1="20" x2="40" y2="130" stroke="rgba(43, 52, 34, 0.3)" />
            <line x1="40" y1="130" x2="300" y2="130" stroke="rgba(43, 52, 34, 0.3)" />
            {Array.from({ length: Math.floor(maxAxis / 100) + 1 }, (_, i) => i * 100).map((value) => {
              const y = 130 - (value / maxAxis) * 90
              return (
                <g key={value}>
                  <line x1="40" y1={y} x2="300" y2={y} stroke="rgba(43, 52, 34, 0.08)" />
                  <text x="8" y={y + 4} fontSize="10" fill="rgba(26, 31, 20, 0.6)">
                    {value}
                  </text>
                </g>
              )
            })}
            <polyline
              fill="none"
              stroke="var(--olive-600)"
              strokeWidth="3"
              points={points}
            />
            {chartData.map((d, index) => {
              const x = 40 + (index / (chartData.length - 1)) * 260
              const y = 130 - (d.total / maxAxis) * 90
              return <circle key={d.key} cx={x} cy={y} r="4" fill="var(--olive-700)" />
            })}
            {chartData.map((d, index) => {
              const x = 40 + (index / (chartData.length - 1)) * 260
              return (
                <text
                  key={`${d.key}-label`}
                  x={x - 8}
                  y="150"
                  fontSize="10"
                  fill="rgba(26, 31, 20, 0.6)"
                >
                  {d.label}
                </text>
              )
            })}
            <text x="8" y="18" fontSize="10" fill="rgba(26, 31, 20, 0.6)">Price</text>
            <text x="264" y="170" fontSize="10" fill="rgba(26, 31, 20, 0.6)">Day</text>
          </svg>
        </div>
        <div className="grid two">
          <div>
            <div className="tag">Total Orders</div>
            <div style={{ fontSize: '28px', fontWeight: 700 }}>{summary.count}</div>
          </div>
          <div>
            <div className="tag">Total Revenue</div>
            <div style={{ fontSize: '28px', fontWeight: 700 }}>
              ₱{summary.revenue.toLocaleString()}
            </div>
          </div>
        </div>
        <div className="grid two" style={{ marginTop: '16px' }}>
          <div>
            <div className="tag">Summary of Sales (Week)</div>
            <div style={{ fontSize: '20px', fontWeight: 600 }}>
              ₱{weeklyTotal.toLocaleString()}
            </div>
          </div>
          <div>
            <div className="tag">Average per Day</div>
            <div style={{ fontSize: '20px', fontWeight: 600 }}>
              ₱{averageDaily.toLocaleString()}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

export default AdminSalesReport
