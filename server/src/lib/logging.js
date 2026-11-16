// Keep access logs independent of URLs, headers, request bodies, and responses.
export const accessLogFormat = ':method :status - :response-time ms'

const knownErrorCodes = new Set([
  'ECONNRESET', 'ECONNREFUSED', 'ECONNABORTED', 'ETIMEDOUT', 'ENOTFOUND',
  'EAI_AGAIN', 'EPIPE', 'EAUTH', 'ESOCKET', 'ECONNECTION', 'ETLS',
  '23502', '23503', '23505', '23514', '22P02', '28P01', '42P01',
  '42703', '42501', '53300', '57P01', '57P02', '57P03',
])
const httpMethods = new Set(['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'CONNECT', 'TRACE'])

// Callers supply a fixed event name. Raw exceptions can contain credentials,
// SQL values, provider responses, and payload fragments even in their stacks.
export function logError(event, error, { method, status } = {}) {
  console.error({
    event,
    ...(httpMethods.has(method) ? { method } : {}),
    ...(Number.isInteger(status) && status >= 100 && status <= 599 ? { status } : {}),
    ...(knownErrorCodes.has(error?.code) ? { code: error.code } : {}),
  })
}
