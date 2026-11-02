export function createApiClient({ baseUrl, fetchImpl = globalThis.fetch, now = Date.now }) {
  const pending = new Map()
  const cached = new Map()
  let generation = 0

  const clearCache = () => {
    generation += 1
    pending.clear()
    cached.clear()
  }

  const readResponse = async (response) => {
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) {
      const error = new Error(payload.message || 'Request failed. Please try again.')
      error.status = response.status
      throw error
    }
    return payload
  }

  const request = (path, { cacheTtl = 0, fresh = false, ...options } = {}) => {
    const method = (options.method || 'GET').toUpperCase()
    const isRead = method === 'GET'
    const key = path
    const shareable = isRead && !options.signal && !options.headers
    if (!isRead) clearCache()
    if (shareable) {
      const entry = cached.get(key)
      if (!fresh && entry && entry.expiresAt > now()) return Promise.resolve(structuredClone(entry.data))
      if (pending.has(key)) return pending.get(key).then(structuredClone)
    }

    const startedGeneration = generation
    const operation = (async () => {
      try {
        const response = await fetchImpl(`${baseUrl}${path}`, {
          credentials: 'include',
          cache: isRead && cacheTtl ? 'no-cache' : 'no-store',
          ...options,
          method,
          headers: {
            ...(options.body ? { 'Content-Type': 'application/json' } : {}),
            ...options.headers,
          },
        })
        const data = await readResponse(response)
        if (shareable && cacheTtl > 0 && startedGeneration === generation) {
          cached.set(key, { data: structuredClone(data), expiresAt: now() + cacheTtl })
        }
        return data
      } finally {
        if (!isRead) clearCache()
      }
    })()

    if (shareable) {
      pending.set(key, operation)
      // Do not let an older response clear a newer request after invalidation.
      const cleanup = () => { if (pending.get(key) === operation) pending.delete(key) }
      operation.then(cleanup, cleanup)
      return operation.then(structuredClone)
    }
    return operation
  }

  const upload = async (path, file, fieldName = 'image') => {
    clearCache()
    try {
      const formData = new FormData()
      formData.append(fieldName, file, file?.name || 'upload.jpg')
      const response = await fetchImpl(`${baseUrl}${path}`, {
        method: 'POST', credentials: 'include', body: formData,
      })
      return await readResponse(response)
    } finally {
      clearCache()
    }
  }

  return { request, upload, clearCache }
}
