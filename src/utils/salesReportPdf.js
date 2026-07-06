const LEGAL_PAGE_TITLE = 'Sales Report'

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => {
    const entities = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }
    return entities[char]
  })
}

function formatCurrency(value) {
  const amount = Math.round(Number(value) || 0)
  return `₱${amount.toLocaleString()}`
}

function formatPrintedDate(value = new Date()) {
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(value)
}

function createMetricIcon(type) {
  const icons = {
    orders:
      '<path d="M15 12h18l3 22H12l3-22Z" fill="none" stroke="currentColor" stroke-width="2"/><path d="M20 16v-3a4 4 0 0 1 8 0v3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
    revenue:
      '<rect x="10" y="15" width="28" height="19" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M14 20h20M17 29h5M28 29h5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="24" cy="25" r="4" fill="none" stroke="currentColor" stroke-width="2"/>',
    weekly:
      '<path d="M12 33V22M21 33V15M30 33V19M39 33H9" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><rect x="10" y="24" width="5" height="9" rx="1" fill="none" stroke="currentColor" stroke-width="2"/><rect x="19" y="17" width="5" height="16" rx="1" fill="none" stroke="currentColor" stroke-width="2"/><rect x="28" y="21" width="5" height="12" rx="1" fill="none" stroke="currentColor" stroke-width="2"/>',
    average:
      '<path d="M10 33h28" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M13 28l7-7 6 5 10-12" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/><path d="M31 14h5v5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
  }

  return `
    <span class="metric-icon" aria-hidden="true">
      <svg viewBox="0 0 48 48" focusable="false">${icons[type]}</svg>
    </span>
  `
}

function createChartSvg(chartData = []) {
  const data = chartData.length
    ? chartData
    : [{ label: '-', total: 0, amount: formatCurrency(0) }]
  const maxTotal = Math.max(...data.map((item) => Number(item.total) || 0), 100)
  const maxAxis = Math.max(100, Math.ceil(maxTotal / 100) * 100)
  const left = 96
  const right = 598
  const top = 44
  const bottom = 214
  const width = right - left
  const height = bottom - top
  const points = data.map((item, index) => {
    const x = left + (index / Math.max(data.length - 1, 1)) * width
    const y = bottom - ((Number(item.total) || 0) / maxAxis) * height
    const amount = formatCurrency(item.total)
    const labelWidth = Math.max(46, amount.length * 7 + 18)
    const labelAbove = y > top + 24
    const labelY = labelAbove ? y - 24 : y + 22
    return {
      ...item,
      x,
      y,
      amount,
      labelX: x - labelWidth / 2,
      labelY,
      labelWidth,
      labelTextY: labelY + 14,
    }
  })
  const pointList = points.map((point) => `${point.x},${point.y}`).join(' ')
  const gridLines = [0.25, 0.5, 0.75].map((ratio) => bottom - ratio * height)

  return `
    <svg class="sales-chart" viewBox="0 0 640 286" role="img" aria-label="Sales per day chart">
      <text x="58" y="32" class="axis-label">Sales</text>
      <line x1="${left}" y1="${top}" x2="${left}" y2="${bottom}" class="axis-line" />
      <line x1="${left}" y1="${bottom}" x2="${right}" y2="${bottom}" class="axis-line" />
      ${gridLines
        .map((y) => `<line x1="${left}" y1="${y}" x2="${right}" y2="${y}" class="grid-line" />`)
        .join('')}
      <polyline points="${pointList}" class="chart-line" />
      ${points
        .map(
          (point) => `
            <g>
              <rect x="${point.labelX}" y="${point.labelY}" width="${point.labelWidth}" height="20" rx="10" class="amount-pill" />
              <text x="${point.x}" y="${point.labelTextY}" text-anchor="middle" class="amount-label">${escapeHtml(point.amount)}</text>
              <circle cx="${point.x}" cy="${point.y}" r="6" class="chart-point" />
            </g>
          `,
        )
        .join('')}
      ${points
        .map(
          (point) => `
            <text x="${point.x}" y="250" text-anchor="middle" class="day-label">${escapeHtml(point.label)}</text>
          `,
        )
        .join('')}
      <text x="586" y="270" class="axis-label">Day</text>
    </svg>
  `
}

function createMetric(label, value, icon) {
  return `
    <div class="metric">
      ${createMetricIcon(icon)}
      <div>
        <div class="metric-label">${escapeHtml(label)}</div>
        <div class="metric-value">${escapeHtml(value)}</div>
      </div>
    </div>
  `
}

export function createSalesReportPdfHtml({
  title = LEGAL_PAGE_TITLE,
  printedAt = new Date(),
  summary = {},
  chartData = [],
  weeklyTotal = 0,
  averageDaily = 0,
} = {}) {
  const metrics = [
    createMetric('TOTAL ORDERS', Number(summary.count || 0).toLocaleString(), 'orders'),
    createMetric('TOTAL REVENUE', formatCurrency(summary.revenue), 'revenue'),
    createMetric('SUMMARY OF SALES (WEEK)', formatCurrency(weeklyTotal), 'weekly'),
    createMetric('AVERAGE PER DAY', formatCurrency(averageDaily), 'average'),
  ].join('')

  return `<!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>${escapeHtml(title)}</title>
        <style>
          @page {
            size: legal portrait;
            margin: 0.58in;
          }

          * {
            box-sizing: border-box;
          }

          html,
          body {
            margin: 0;
            min-height: 100%;
            color: #1b1f15;
            font-family: Georgia, "Times New Roman", serif;
            background: #111;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          .sheet {
            width: 8.5in;
            min-height: 14in;
            margin: 0 auto;
            padding: 0.74in 0.62in;
            background:
              radial-gradient(circle at 50% 18%, rgba(221, 216, 194, 0.18), transparent 34%),
              #fff;
          }

          .report-header {
            display: grid;
            grid-template-columns: 1fr auto;
            gap: 24px;
            align-items: end;
          }

          h1 {
            margin: 0;
            font-size: 34px;
            line-height: 1;
            letter-spacing: -0.01em;
            font-weight: 700;
          }

          .printed-date {
            margin: 0 0 3px;
            color: #4c5d34;
            font-size: 11px;
            letter-spacing: 0.12em;
            text-transform: uppercase;
            white-space: nowrap;
          }

          .rule {
            height: 1px;
            margin: 18px 0 28px;
            background: #b9a66c;
          }

          .ornament {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 10px;
            margin-bottom: 22px;
            color: #b9a66c;
          }

          .ornament::before,
          .ornament::after {
            content: "";
            width: 40px;
            height: 1px;
            background: currentColor;
          }

          .ornament span {
            width: 7px;
            height: 7px;
            border: 1px solid currentColor;
            transform: rotate(45deg);
          }

          .report-card,
          .metrics-card {
            border: 1px solid rgba(43, 52, 34, 0.09);
            border-radius: 12px;
            background: rgba(255, 255, 255, 0.96);
            box-shadow: 0 12px 32px rgba(26, 31, 20, 0.1);
          }

          .report-card {
            padding: 26px 28px 22px;
          }

          h2 {
            margin: 0 0 24px;
            font-size: 24px;
            line-height: 1.1;
          }

          .section-kicker,
          .metric-label {
            color: #4d6531;
            font-size: 12px;
            font-weight: 700;
            letter-spacing: 0.06em;
            text-transform: uppercase;
          }

          .chart-wrap {
            margin-top: 8px;
          }

          .sales-chart {
            display: block;
            width: 100%;
            height: auto;
          }

          .axis-line {
            stroke: rgba(43, 52, 34, 0.26);
            stroke-width: 1.4;
          }

          .grid-line {
            stroke: rgba(43, 52, 34, 0.09);
            stroke-width: 1;
            stroke-dasharray: 3 4;
          }

          .chart-line {
            fill: none;
            stroke: #3f5728;
            stroke-width: 4.5;
            stroke-linecap: round;
            stroke-linejoin: round;
          }

          .chart-point {
            fill: #3f5728;
            stroke: #2d3d1d;
            stroke-width: 1.5;
          }

          .amount-pill {
            fill: #fff;
            stroke: rgba(43, 52, 34, 0.14);
            filter: drop-shadow(0 4px 8px rgba(26, 31, 20, 0.08));
          }

          .amount-label {
            fill: #1b1f15;
            font-size: 10px;
            font-weight: 700;
          }

          .axis-label,
          .day-label {
            fill: rgba(26, 31, 20, 0.62);
            font-size: 12px;
          }

          .metrics-card {
            display: grid;
            grid-template-columns: 1fr 1fr;
            margin-top: 28px;
            overflow: hidden;
          }

          .metric {
            display: grid;
            grid-template-columns: 58px 1fr;
            gap: 16px;
            align-items: center;
            min-height: 98px;
            padding: 20px 24px;
          }

          .metric:nth-child(odd) {
            border-right: 1px solid rgba(185, 166, 108, 0.34);
          }

          .metric:nth-child(-n + 2) {
            border-bottom: 1px solid rgba(185, 166, 108, 0.34);
          }

          .metric-icon {
            width: 48px;
            height: 48px;
            border-radius: 999px;
            display: grid;
            place-items: center;
            color: #4d6531;
            background: #eef1e6;
          }

          .metric-icon svg {
            width: 32px;
            height: 32px;
          }

          .metric-value {
            margin-top: 6px;
            font-size: 30px;
            line-height: 1;
            font-weight: 700;
          }

          @media print {
            html,
            body {
              background: #fff;
            }

            .sheet {
              width: auto;
              min-height: auto;
              margin: 0;
              padding: 0;
              background: #fff;
            }
          }
        </style>
      </head>
      <body>
        <main class="sheet">
          <header class="report-header">
            <h1>${escapeHtml(title)}</h1>
            <p class="printed-date">Date Printed: ${escapeHtml(formatPrintedDate(printedAt))}</p>
          </header>
          <div class="rule"></div>
          <div class="ornament"><span></span></div>
          <section class="report-card">
            <h2>Sales Summary</h2>
            <div class="section-kicker">Sales per day</div>
            <div class="chart-wrap">
              ${createChartSvg(chartData)}
            </div>
          </section>
          <section class="metrics-card" aria-label="Sales metrics">
            ${metrics}
          </section>
        </main>
      </body>
    </html>`
}

export function printSalesReportPdf(reportData) {
  const iframe = document.createElement('iframe')
  iframe.title = 'Sales Report PDF'
  iframe.style.position = 'fixed'
  iframe.style.right = '0'
  iframe.style.bottom = '0'
  iframe.style.width = '1px'
  iframe.style.height = '1px'
  iframe.style.border = '0'
  iframe.style.opacity = '0'
  document.body.appendChild(iframe)

  const printWindow = iframe.contentWindow
  const printDocument = iframe.contentDocument || printWindow?.document

  if (!printWindow || !printDocument) {
    iframe.remove()
    window.print()
    return
  }

  printDocument.open()
  printDocument.write(createSalesReportPdfHtml(reportData))
  printDocument.close()

  const cleanup = () => {
    setTimeout(() => iframe.remove(), 1000)
  }

  printWindow.addEventListener('afterprint', cleanup, { once: true })
  setTimeout(() => {
    printWindow.focus()
    printWindow.print()
    setTimeout(() => {
      if (document.body.contains(iframe)) iframe.remove()
    }, 8000)
  }, 250)
}
