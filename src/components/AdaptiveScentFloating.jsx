import { useEffect, useRef, useState } from 'react'
import AdaptiveScentPanel from './AdaptiveScentPanel.jsx'

const WEATHER_ICONS = {
  sunny: '☀️',
  rainy: '🌧️',
  cloudy: '☁️',
  humid: '💧',
  cool: '🍂',
}

const DEFAULT_POSITION = { x: 22, y: 92 }
const POSITION_KEY = 'severino_adaptive_scent_position'

function getStoredPosition() {
  if (typeof window === 'undefined') return DEFAULT_POSITION
  try {
    const stored = JSON.parse(sessionStorage.getItem(POSITION_KEY) || 'null')
    if (Number.isFinite(stored?.x) && Number.isFinite(stored?.y)) return stored
  } catch {
    return DEFAULT_POSITION
  }
  return DEFAULT_POSITION
}

function clampPosition(position) {
  if (typeof window === 'undefined') return position
  const size = 68
  return {
    x: Math.min(Math.max(position.x, 12), Math.max(window.innerWidth - size - 12, 12)),
    y: Math.min(Math.max(position.y, 80), Math.max(window.innerHeight - size - 12, 80)),
  }
}

function AdaptiveScentFloating({
  adaptive,
  recommendationsLimit,
  onViewProduct,
}) {
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState(() => clampPosition(getStoredPosition()))
  const dragRef = useRef({
    dragging: false,
    moved: false,
    offsetX: 0,
    offsetY: 0,
    startX: 0,
    startY: 0,
  })
  const current = adaptive.adaptiveData.current
  const mood = current?.mood || 'cloudy'
  const weatherIcon = WEATHER_ICONS[mood] || '🌦️'
  const recommendations =
    typeof recommendationsLimit === 'number'
      ? adaptive.adaptiveData.recommendations.slice(0, recommendationsLimit)
      : adaptive.adaptiveData.recommendations

  useEffect(() => {
    if (!open) return undefined
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [open])

  useEffect(() => {
    const handleResize = () => {
      setPosition((prev) => {
        const next = clampPosition(prev)
        sessionStorage.setItem(POSITION_KEY, JSON.stringify(next))
        return next
      })
    }

    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const handlePointerDown = (event) => {
    const rect = event.currentTarget.getBoundingClientRect()
    dragRef.current = {
      dragging: true,
      moved: false,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
      startX: event.clientX,
      startY: event.clientY,
    }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const handlePointerMove = (event) => {
    if (!dragRef.current.dragging) return
    const next = clampPosition({
      x: event.clientX - dragRef.current.offsetX,
      y: event.clientY - dragRef.current.offsetY,
    })
    const distance = Math.hypot(event.clientX - dragRef.current.startX, event.clientY - dragRef.current.startY)
    if (distance > 5) dragRef.current.moved = true
    setPosition(next)
    sessionStorage.setItem(POSITION_KEY, JSON.stringify(next))
  }

  const handlePointerUp = (event) => {
    if (!dragRef.current.dragging) return
    event.currentTarget.releasePointerCapture(event.pointerId)
    const shouldOpen = !dragRef.current.moved
    dragRef.current.dragging = false
    window.setTimeout(() => {
      if (shouldOpen) setOpen(true)
    }, 0)
  }

  return (
    <>
      <button
        className={`adaptive-floating-button ${adaptive.enabled ? 'active' : ''} mood-${mood}`}
        type="button"
        aria-label="Open Adaptive Scent"
        style={{ left: `${position.x}px`, top: `${position.y}px` }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        <span className="adaptive-floating-button__icon">{weatherIcon}</span>
        {adaptive.enabled && <span className="adaptive-floating-button__pulse" />}
      </button>

      {open && (
        <div className="modal-backdrop adaptive-modal-backdrop" role="presentation" onClick={() => setOpen(false)}>
          <div
            className="modal-card adaptive-modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="adaptive-scent-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              className="modal-close"
              type="button"
              aria-label="Close Adaptive Scent"
              onClick={() => setOpen(false)}
            >
              X
            </button>
            <h2 id="adaptive-scent-modal-title" className="sr-only">
              Adaptive Scent
            </h2>
            <AdaptiveScentPanel
              enabled={adaptive.enabled}
              onToggleEnabled={adaptive.setAdaptiveEnabled}
              loading={adaptive.status.loading}
              error={adaptive.status.error}
              current={adaptive.adaptiveData.current}
              dailyForecast={adaptive.adaptiveData.dailyForecast}
              recommendations={recommendations}
              usingDefault={adaptive.status.usingDefault}
              locationLabel={adaptive.locationLabel}
              onUseDefaultLocation={adaptive.useDefaultLocation}
              onViewProduct={(productId) => {
                setOpen(false)
                onViewProduct(productId)
              }}
            />
          </div>
        </div>
      )}
    </>
  )
}

export default AdaptiveScentFloating
