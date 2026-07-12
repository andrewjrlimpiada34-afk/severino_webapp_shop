import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../lib/api.js'
import { clearLocalProfile, setLocalProfile } from '../lib/auth.js'

const AuthContext = createContext(null)

const transferPendingBuyNow = (user) => {
  if (!user?.id || user.role === 'admin') return
  const stored = localStorage.getItem('severino_pending_buy_now')
  if (!stored) return
  try {
    const parsed = JSON.parse(stored)
    const legacyProductId = Array.isArray(parsed) ? parsed[0] : null
    const directPurchase = legacyProductId
      ? { productId: legacyProductId, quantity: 1, createdAt: Date.now() }
      : parsed
    if (directPurchase?.productId && Number(directPurchase.quantity) > 0) {
      localStorage.setItem(
        `severino_direct_checkout_${user.id}`,
        JSON.stringify({
          productId: String(directPurchase.productId),
          quantity: Math.min(100, Math.max(1, Number(directPurchase.quantity) || 1)),
          createdAt: Number(directPurchase.createdAt) || Date.now(),
        })
      )
      localStorage.removeItem(`checkout_selection_${user.id}`)
    }
  } catch {
    // Ignore malformed legacy data and clear it below.
  } finally {
    localStorage.removeItem('severino_pending_buy_now')
  }
}

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
      transferPendingBuyNow(resolved)
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

  const startLogin = async (identifier, password) => {
    await api.login({ identifier, email: identifier, password })
    const data = await api.me()
    const resolved = await resolveUserTheme(data)
    setUser(resolved)
    setLocalProfile(resolved)
    transferPendingBuyNow(resolved)
    return resolved
  }

  const register = async (data) => {
    return api.register(data)
  }

  const sendRegisterOtp = async (email) => {
    return api.sendRegisterOtp(email)
  }

  const verifyRegisterOtp = async (payload) => {
    return api.verifyRegisterOtp(payload)
  }

  const logout = useCallback(async () => {
    await api.logout()
    setUser(null)
    clearLocalProfile()
    document.documentElement.removeAttribute('data-theme')
    sessionStorage.removeItem('admin_session')
    Object.keys(sessionStorage)
      .filter((key) => key.startsWith('severino_login_popup_seen_'))
      .forEach((key) => sessionStorage.removeItem(key))
  }, [])

  const value = useMemo(
    () => ({
      user,
      loading,
      startLogin,
      register,
      sendRegisterOtp,
      verifyRegisterOtp,
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
