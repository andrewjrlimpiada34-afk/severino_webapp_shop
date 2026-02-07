import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../lib/api.js'
import { clearLocalProfile, setLocalProfile } from '../lib/auth.js'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const idleTimer = useRef(null)

  const applyTheme = (theme) => {
    if (!theme || theme === 'Default') {
      document.documentElement.removeAttribute('data-theme')
      return
    }
    document.documentElement.setAttribute('data-theme', theme)
  }

  const resolveUserTheme = async (me) => {
    if (!me || me.role === 'admin') {
      document.documentElement.removeAttribute('data-theme')
      return { ...me }
    }
    try {
      const profile = await api.profile()
      const stored = localStorage.getItem(`severino_theme_${me.id}`)
      const theme = profile.preferredTheme || stored || 'Default'
      localStorage.setItem(`severino_theme_${me.id}`, theme)
      applyTheme(theme)
      return { ...me, preferredTheme: theme }
    } catch {
      document.documentElement.removeAttribute('data-theme')
      return { ...me }
    }
  }

  const refresh = async () => {
    try {
      const data = await api.me()
      const resolved = await resolveUserTheme(data)
      setUser(resolved)
      setLocalProfile(resolved)
      return resolved
    } catch {
      setUser(null)
      clearLocalProfile()
      return null
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refresh()
  }, [])

  const startLogin = async (email, password) => {
    await api.login({ email, password })
    const data = await api.me()
    const resolved = await resolveUserTheme(data)
    setUser(resolved)
    setLocalProfile(resolved)
    if (resolved?.role !== 'admin') {
      sessionStorage.setItem('severino_login_popup', '1')
    }
    if (resolved?.id) {
      const pending = JSON.parse(localStorage.getItem('severino_pending_buy_now') || '[]')
      if (pending.length) {
        try {
          const cart = await api.cart()
          const nextItems = [...cart.items]
          pending.forEach((productId) => {
            const existing = nextItems.find((item) => item.productId === productId)
            if (existing) {
              existing.quantity = Math.min(100, existing.quantity + 1)
            } else {
              nextItems.push({ productId, quantity: 1 })
            }
          })
          await api.updateCart(nextItems)
          const selectionKey = `checkout_selection_${resolved.id}`
          localStorage.setItem(selectionKey, JSON.stringify(pending))
        } catch {
          // ignore pending cart failures
        } finally {
          localStorage.removeItem('severino_pending_buy_now')
        }
      }
    }
    return resolved
  }

  const register = async (name, email, password, extra = {}) => {
    return api.register({ name, email, password, ...extra })
  }

  const logout = async () => {
    await api.logout()
    setUser(null)
    clearLocalProfile()
    document.documentElement.removeAttribute('data-theme')
    sessionStorage.removeItem('admin_session')
    sessionStorage.removeItem('severino_login_popup')
  }

  const value = useMemo(
    () => ({
      user,
      loading,
      startLogin,
      register,
      logout,
      refresh,
    }),
    [user, loading]
  )

  useEffect(() => {
    if (!user) return undefined
    const idleMs = 15 * 60 * 1000

    const resetTimer = () => {
      if (idleTimer.current) clearTimeout(idleTimer.current)
      idleTimer.current = setTimeout(() => {
        logout()
      }, idleMs)
    }

    const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart']
    events.forEach((event) => window.addEventListener(event, resetTimer))
    resetTimer()

    const clearAdminSession = () => {
      sessionStorage.removeItem('admin_session')
    }
    window.addEventListener('beforeunload', clearAdminSession)

    return () => {
      if (idleTimer.current) clearTimeout(idleTimer.current)
      events.forEach((event) => window.removeEventListener(event, resetTimer))
      window.removeEventListener('beforeunload', clearAdminSession)
    }
  }, [user])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => useContext(AuthContext)
