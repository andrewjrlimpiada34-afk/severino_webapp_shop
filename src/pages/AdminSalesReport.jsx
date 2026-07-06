import { useEffect, useMemo, useState } from 'react'
import { api } from '../lib/api.js'
import { printSalesReportPdf } from '../utils/salesReportPdf.js'

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
    orders
      .filter((order) => order.status !== 'Cancelled' && order.status !== 'Removed')
      .forEach((order) => {
      const day = order.createdAt ? new Date(order.createdAt).toLocaleDateString() : ''
      const item = days.find((d) => d.key === day)
      if (item) item.total += order.total || 0
      })
    return days
  }, [orders])

  const maxAxis = useMemo(
    () => Math.max(100, Math.ceil(Math.max(...chartData.map((d) => d.total), 100) / 100) * 100),
    [chartData],
  )

  const chartPoints = useMemo(() => {
    if (chartData.length === 0) return []
    return chartData
      .map((d, index) => {
        const x = 44 + (index / Math.max(chartData.length - 1, 1)) * 270
        const y = 126 - (d.total / maxAxis) * 82
        const labelAbove = y > 28
        const labelY = labelAbove ? y - 12 : y + 20
        return {
          ...d,
          x,
          y,
          labelY,
          labelAbove,
          amount: `₱${Math.round(d.total).toLocaleString()}`,
        }
      })
  }, [chartData, maxAxis])

  const points = useMemo(() => {
    return chartPoints.map((point) => `${point.x},${point.y}`).join(' ')
  }, [chartPoints])

  const softGridLines = useMemo(() => {
    return [0.25, 0.5, 0.75].map((ratio) => 126 - ratio * 82)
  }, [])

  const weeklyTotal = chartData.reduce((sum, day) => sum + day.total, 0)
  const averageDaily = chartData.length ? Math.round(weeklyTotal / chartData.length) : 0

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
          <button
            className="button secondary"
            type="button"
            onClick={() =>
              printSalesReportPdf({
                summary,
                chartData,
                weeklyTotal,
                averageDaily,
              })
            }
          >
            Print PDF
          </button>
        </div>
        <div className="card" style={{ marginTop: '16px' }}>
          <div className="tag">Sales per day</div>
          <svg viewBox="0 0 360 190" width="100%" height="190" role="img" aria-label="Sales per day line graph">
            <line x1="44" y1="30" x2="44" y2="126" stroke="rgba(43, 52, 34, 0.22)" />
            <line x1="44" y1="126" x2="314" y2="126" stroke="rgba(43, 52, 34, 0.22)" />
            {softGridLines.map((y) => (
              <line key={y} x1="44" y1={y} x2="314" y2={y} stroke="rgba(43, 52, 34, 0.07)" />
            ))}
            <polyline
              fill="none"
              stroke="var(--olive-600)"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              points={points}
            />
            {chartPoints.map((point) => (
              <g key={`${point.key}-point`}>
                <circle cx={point.x} cy={point.y} r="4.5" fill="var(--olive-700)" />
                <rect
                  x={point.x - 22}
                  y={point.labelY - 11}
                  width="44"
                  height="15"
                  rx="7"
                  fill="rgba(255, 255, 255, 0.82)"
                  stroke="rgba(43, 52, 34, 0.08)"
                />
                <text
                  x={point.x}
                  y={point.labelY}
                  textAnchor="middle"
                  fontSize="8.5"
                  fontWeight="700"
                  fill="var(--olive-900)"
                >
                  {point.amount}
                </text>
              </g>
            ))}
            {chartPoints.map((point) => {
              return (
                <text
                  key={`${point.key}-label`}
                  x={point.x}
                  y="150"
                  textAnchor="middle"
                  fontSize="10"
                  fill="rgba(26, 31, 20, 0.6)"
                >
                  {point.label}
                </text>
              )
            })}
            <text x="16" y="22" fontSize="10" fill="rgba(26, 31, 20, 0.58)">Sales</text>
            <text x="292" y="174" fontSize="10" fill="rgba(26, 31, 20, 0.58)">Day</text>
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
