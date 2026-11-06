import Modal from './Modal.jsx'
import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
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
const INTRO_KEY = 'severino_adaptive_scent_intro_seen'

function shouldShowIntroduction() {
  try { return sessionStorage.getItem(INTRO_KEY) !== '1' }
  catch { return true }
}

function getDefaultPosition() {
  if (typeof window === 'undefined') return DEFAULT_POSITION
  return { x: window.innerWidth - 76, y: window.innerHeight - (window.innerWidth <= 640 ? 180 : 100) }
}

function getStoredPosition() {
  if (typeof window === 'undefined') return DEFAULT_POSITION
  try {
    const stored = JSON.parse(sessionStorage.getItem(POSITION_KEY) || 'null')
    if (Number.isFinite(stored?.x) && Number.isFinite(stored?.y)) return stored
  } catch {
    return getDefaultPosition()
  }
  return getDefaultPosition()
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
  const [showIntroduction, setShowIntroduction] = useState(shouldShowIntroduction)
  const introductionId = useId()
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

  const dismissIntroduction = () => {
    setShowIntroduction(false)
    try { sessionStorage.setItem(INTRO_KEY, '1') } catch { /* The tip still dismisses when storage is unavailable. */ }
  }
  const openPanel = () => {
    dismissIntroduction()
    setOpen(true)
  }
  const introductionVisible = showIntroduction && !open && !adaptive.enabled
  const viewportWidth = document.documentElement.clientWidth || window.innerWidth
  const introductionWidth = Math.min(220, viewportWidth - 24)
  const introductionLeft = Math.max(12, Math.min(position.x + 28 - introductionWidth / 2, viewportWidth - introductionWidth - 12))
  const introductionBelow = position.y < 170

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
    if (event.button !== 0) return
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
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    dragRef.current.dragging = false
  }

  return (
    <>
      <button
        className={`adaptive-floating-button ${adaptive.enabled ? 'active' : ''} mood-${mood}`}
        type="button"
        aria-label="Open Adaptive Scent"
        aria-describedby={introductionVisible ? introductionId : undefined}
        aria-haspopup="dialog"
        title="Find my scent · Drag to move"
        style={{ left: `${position.x}px`, top: `${position.y}px` }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={() => { dragRef.current.dragging = false; dragRef.current.moved = true }}
        onClick={(event) => { if (event.detail === 0 || !dragRef.current.moved) openPanel() }}
      >
        <span className="adaptive-floating-button__icon">{weatherIcon}</span>
        {adaptive.enabled && <span className="adaptive-floating-button__pulse" />}
      </button>

      {introductionVisible && createPortal(
        <aside className={`adaptive-scent-hint ${introductionBelow ? 'is-below' : ''}`} aria-label="Adaptive Scent introduction" style={{ left: introductionLeft, top: introductionBelow ? position.y + 80 : position.y - 102, width: introductionWidth, '--thought-offset': `${Math.max(16, Math.min(introductionWidth - 24, position.x + 28 - introductionLeft))}px` }}>
          <button id={introductionId} className="adaptive-scent-hint__message" type="button" onClick={openPanel}>Try this Adaptive Scent Feature</button>
          <button className="adaptive-scent-hint__dismiss" type="button" aria-label="Dismiss Adaptive Scent tip" onClick={dismissIntroduction}>×</button>
        </aside>, document.body
      )}

      {open && (
        <Modal className="adaptive-modal-backdrop" role="presentation" onClick={() => setOpen(false)}>
          <div
            className="modal-card adaptive-modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="adaptive-scent-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id="adaptive-scent-modal-title" className="sr-only">
              Adaptive Scent
            </h2>
            <AdaptiveScentPanel
              onClose={() => setOpen(false)}
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
        </Modal>
      )}
    </>
  )
}

export default AdaptiveScentFloating
