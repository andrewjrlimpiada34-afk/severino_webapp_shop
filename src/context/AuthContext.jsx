import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../lib/api.js'
import { clearLocalProfile, setLocalProfile } from '../lib/auth.js'
import { loginErrors, normalizeLoginIdentifier } from '../../server/shared/loginValidation.js'

const AuthContext = createContext(null)

const applyTheme = (theme) => {
  if (!theme || theme === 'Default') {
    document.documentElement.removeAttribute('data-theme')
  } else {
    document.documentElement.setAttribute('data-theme', theme)
  }
}

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
  const userId = user?.id
  const idleTimer = useRef(null)
  const sessionVersion = useRef(0)
  const currentUserId = useRef(null)

  const acceptUser = useCallback((me) => {
    let resolved = me
    if (me.role === 'admin') {
      document.documentElement.removeAttribute('data-theme')
    } else {
      const stored = localStorage.getItem(`severino_theme_${me.id}`)
      const theme = me.preferredTheme || stored || 'Default'
      localStorage.setItem(`severino_theme_${me.id}`, theme)
      applyTheme(theme)
      resolved = { ...me, preferredTheme: theme }
    }
    currentUserId.current = resolved.id
    transferPendingBuyNow(resolved)
    setUser(resolved)
    setLocalProfile(resolved)
    return resolved
  }, [])

  const clearSession = useCallback(() => {
    currentUserId.current = null
    setUser(null)
    clearLocalProfile()
    api.clearCache()
    document.documentElement.removeAttribute('data-theme')
    sessionStorage.removeItem('admin_session')
    Object.keys(sessionStorage)
      .filter((key) => key.startsWith('severino_login_popup_seen_'))
      .forEach((key) => sessionStorage.removeItem(key))
  }, [])

  const refresh = useCallback(async () => {
    const version = ++sessionVersion.current
    try {
      const data = await api.me()
      if (version !== sessionVersion.current) return null
      return acceptUser(data)
    } catch {
      if (version === sessionVersion.current) clearSession()
      return null
    } finally {
      if (version === sessionVersion.current) setLoading(false)
    }
  }, [acceptUser, clearSession])

  useEffect(() => {
    refresh()
  }, [refresh])

  const startLogin = useCallback(async (identifier, password) => {
    const errors = loginErrors(identifier, password)
    if (errors.identifier || errors.password) throw new Error(errors.identifier || errors.password)
    const version = ++sessionVersion.current
    const result = await api.login({ identifier: normalizeLoginIdentifier(identifier), password })
    // Fall back to /me while an older backend is still deployed.
    const data = result.user || await api.me()
    if (version !== sessionVersion.current) throw new Error('Sign-in was interrupted. Please try again.')
    setLoading(false)
    return acceptUser(data)
  }, [acceptUser])

  const register = useCallback((data) => api.register(data), [])

  const sendRegisterOtp = useCallback((email) => api.sendRegisterOtp(email), [])

  const verifyRegisterOtp = useCallback((payload) => api.verifyRegisterOtp(payload), [])

  const updateUser = useCallback((profile) => {
    if (profile?.id === currentUserId.current) acceptUser(profile)
  }, [acceptUser])

  const logout = useCallback(async () => {
    sessionVersion.current += 1
    try {
      await api.logout()
    } finally {
      clearSession()
      setLoading(false)
    }
  }, [clearSession])

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
      updateUser,
    }),
    [user, loading, startLogin, register, sendRegisterOtp, verifyRegisterOtp, logout, refresh, updateUser]
  )

  useEffect(() => {
    if (!userId) return undefined
    const idleMs = 15 * 60 * 1000

    const resetTimer = () => {
      if (idleTimer.current) clearTimeout(idleTimer.current)
      idleTimer.current = setTimeout(() => {
        logout().catch(() => {})
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
  }, [userId, logout])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => useContext(AuthContext)
