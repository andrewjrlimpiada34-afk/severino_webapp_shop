export const createCache = (ttlMs = 15000) => {
  let value = null
  let expiresAt = 0
  return {
    get() {
      if (Date.now() > expiresAt) return null
      return value
    },
    set(next) {
      value = next
      expiresAt = Date.now() + ttlMs
      return value
    },
    clear() {
      value = null
      expiresAt = 0
    },
  }
}
