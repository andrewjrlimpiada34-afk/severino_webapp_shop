export function normalizeClientOrigin(value) {
  if (typeof value !== 'string') return ''
  const candidate = value.trim().replace(/^(['"])(.*)\1$/, '$2')
  try {
    const url = new URL(candidate)
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.hostname.includes('*')) return ''
    return url.origin
  } catch { return '' }
}

export function getClientOrigins(env = process.env) {
  const configured = env.CLIENT_ORIGIN || (env.NODE_ENV === 'production' ? '' : 'http://localhost:5173')
  return [...new Set(configured.split(',').map(normalizeClientOrigin).filter(Boolean))]
}

export const getPrimaryClientOrigin = (env = process.env) => getClientOrigins(env)[0] || '/'

export function createCorsOptions(env = process.env) {
  const allowedOrigins = new Set(getClientOrigins(env))
  return {
    credentials: true,
    origin(origin, callback) {
      if (!origin || allowedOrigins.has(origin)) return callback(null, true)
      const error = new Error('Not allowed by CORS')
      error.statusCode = 403
      return callback(error)
    },
  }
}
