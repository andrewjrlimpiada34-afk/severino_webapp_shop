import { useCallback, useRef, useState } from 'react'
import ActionAnimationContext from './actionAnimationStore.js'

const actionLabels = {
  cart: 'Added to cart',
  favorite: 'Saved to favorites',
  search: 'Searching scents',
  checkout: 'Order confirmed',
}

function ActionIcon({ type }) {
  if (type === 'favorite') {
    return (
      <svg className="action-animation-icon" viewBox="0 0 64 64" aria-hidden="true">
        <path
          className="action-animation-heart"
          d="M32 52S13 40.2 8.2 27.8C5.2 20 9.4 12 17.2 12c5 0 9 2.8 11.8 7.1C31.9 14.8 36 12 41 12c7.8 0 12 8 8.8 15.8C45 40.2 32 52 32 52Z"
          fill="currentColor"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinejoin="round"
        />
      </svg>
    )
  }

  if (type === 'search') {
    return (
      <svg className="action-animation-icon" viewBox="0 0 64 64" aria-hidden="true">
        <circle
          className="action-animation-search-circle"
          cx="28"
          cy="28"
          r="16"
          fill="none"
          stroke="currentColor"
          strokeWidth="4"
        />
        <path
          className="action-animation-search-handle"
          d="M40 40l13 13"
          fill="none"
          stroke="currentColor"
          strokeWidth="4"
          strokeLinecap="round"
        />
      </svg>
    )
  }

  if (type === 'checkout') {
    return (
      <svg className="action-animation-icon" viewBox="0 0 64 64" aria-hidden="true">
        <circle
          className="action-animation-ring"
          cx="32"
          cy="32"
          r="23"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
        />
        <path
          className="action-animation-check"
          d="M21 33.5l7.2 7.2L44 24.8"
          fill="none"
          stroke="currentColor"
          strokeWidth="4.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    )
  }

  return (
    <svg className="action-animation-icon" viewBox="0 0 64 64" aria-hidden="true">
      <path
        d="M15 17h37l-4 22a5 5 0 0 1-4.9 4H24.4a5 5 0 0 1-4.9-4L15.2 11H9"
        fill="none"
        stroke="currentColor"
        strokeWidth="3.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="25" cy="52" r="3.6" fill="currentColor" />
      <circle cx="44" cy="52" r="3.6" fill="currentColor" />
      <path
        className="action-animation-check"
        d="M30 30.5l5 5 12-13"
        fill="none"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function ActionAnimationOverlay({ action }) {
  if (!action) return null

  return (
    <div
      className={`action-animation-layer action-animation-layer--${action.type}`}
      style={{ '--action-duration': `${action.duration}ms` }}
      aria-live="polite"
    >
      <div className="action-animation-card" role="status">
        <div className="action-animation-orb">
          <ActionIcon type={action.type} />
        </div>
        <div className="action-animation-label">{action.message}</div>
      </div>
    </div>
  )
}

function ActionAnimationProvider({ children }) {
  const [action, setAction] = useState(null)
  const timeoutRef = useRef(null)
  const resolveRef = useRef(null)

  const playActionAnimation = useCallback((type, options = {}) => {
    const duration = options.duration || 900
    const message = options.message || actionLabels[type] || 'Done'

    window.clearTimeout(timeoutRef.current)
    if (resolveRef.current) {
      resolveRef.current()
      resolveRef.current = null
    }

    return new Promise((resolve) => {
      resolveRef.current = resolve
      setAction({
        key: `${type}-${Date.now()}`,
        type,
        message,
        duration,
      })

      timeoutRef.current = window.setTimeout(() => {
        setAction(null)
        resolveRef.current = null
        resolve()
      }, duration)
    })
  }, [])

  return (
    <ActionAnimationContext.Provider value={{ playActionAnimation }}>
      {children}
      <ActionAnimationOverlay action={action} key={action?.key || 'idle'} />
    </ActionAnimationContext.Provider>
  )
}

export { ActionAnimationProvider }
