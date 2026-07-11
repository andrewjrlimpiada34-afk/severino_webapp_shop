import { useCallback, useRef, useState } from 'react'
import ActionAnimationContext from './actionAnimationStore.js'

const actionLabels = {
  cart: 'Added to cart',
  favorite: 'Saved to favorites',
  search: 'Searching scents',
  checkout: 'Order confirmed',
  home: 'Opening home',
  shop: 'Opening shop',
  feedback: 'Opening feedback',
  orders: 'Opening orders',
  notifications: 'Opening notifications',
  account: 'Opening account',
  login: 'Opening login',
}

function ActionIcon({ type }) {
  if (type === 'home') {
    return (
      <svg className="action-animation-icon" viewBox="0 0 64 64" aria-hidden="true">
        <path
          d="M12 30.5 32 13l20 17.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M18 29v22h28V29"
          fill="none"
          stroke="currentColor"
          strokeWidth="4"
          strokeLinejoin="round"
        />
        <path d="M27 51V38h10v13" fill="none" stroke="currentColor" strokeWidth="4" />
      </svg>
    )
  }

  if (type === 'shop') {
    return (
      <svg className="action-animation-icon" viewBox="0 0 64 64" aria-hidden="true">
        <path
          d="M18 24h28l3 27H15l3-27Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="4"
          strokeLinejoin="round"
        />
        <path
          d="M24 25v-5a8 8 0 0 1 16 0v5"
          fill="none"
          stroke="currentColor"
          strokeWidth="4"
          strokeLinecap="round"
        />
      </svg>
    )
  }

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

  if (type === 'feedback') {
    return (
      <svg className="action-animation-icon" viewBox="0 0 64 64" aria-hidden="true">
        <path
          d="M14 17h36v27H27L16 52V44h-2V17Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="4"
          strokeLinejoin="round"
        />
        <path
          d="M23 27h18M23 35h12"
          fill="none"
          stroke="currentColor"
          strokeWidth="4"
          strokeLinecap="round"
        />
      </svg>
    )
  }

  if (type === 'orders') {
    return (
      <svg className="action-animation-icon" viewBox="0 0 64 64" aria-hidden="true">
        <path
          d="M20 13h24v39H20V13Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="4"
          strokeLinejoin="round"
        />
        <path
          d="M26 24h12M26 32h12M26 40h8"
          fill="none"
          stroke="currentColor"
          strokeWidth="4"
          strokeLinecap="round"
        />
      </svg>
    )
  }

  if (type === 'notifications') {
    return (
      <svg className="action-animation-icon" viewBox="0 0 64 64" aria-hidden="true">
        <path
          d="M18 43h28l-3-6.2a13 13 0 0 1-1.3-5.7V27a9.7 9.7 0 1 0-19.4 0v4.1a13 13 0 0 1-1.3 5.7L18 43Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M27 48a5 5 0 0 0 10 0"
          fill="none"
          stroke="currentColor"
          strokeWidth="4"
          strokeLinecap="round"
        />
      </svg>
    )
  }

  if (type === 'account') {
    return (
      <svg className="action-animation-icon" viewBox="0 0 64 64" aria-hidden="true">
        <circle cx="32" cy="24" r="10" fill="none" stroke="currentColor" strokeWidth="4" />
        <path
          d="M16 52c2.8-9.5 9-14 16-14s13.2 4.5 16 14"
          fill="none"
          stroke="currentColor"
          strokeWidth="4"
          strokeLinecap="round"
        />
      </svg>
    )
  }

  if (type === 'login') {
    return (
      <svg className="action-animation-icon" viewBox="0 0 64 64" aria-hidden="true">
        <path
          d="M30 17h19v30H30"
          fill="none"
          stroke="currentColor"
          strokeWidth="4"
          strokeLinejoin="round"
        />
        <path
          d="M14 32h24M29 23l9 9-9 9"
          fill="none"
          stroke="currentColor"
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
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
