import { logError } from '../lib/logging.js'

export const errorHandler = (error, req, res, next) => {
  const requestedStatus = Number(error.statusCode || error.status)
  const status = requestedStatus >= 400 && requestedStatus < 600 ? requestedStatus : 500
  logError('request_failed', error, {
    method: req.method,
    status,
  })

  if (res.headersSent) {
    // Express may log errors delegated to its final handler in development.
    const safeError = new Error('Response stream failed')
    safeError.stack = safeError.message
    return next(safeError)
  }

  // JSON parser errors include a fragment of the submitted body in the message.
  if (error.type === 'entity.parse.failed') {
    return res.status(status).json({ message: 'Invalid JSON request body' })
  }

  return res.status(status).json({
    message: status < 500 ? error.message : 'Internal server error',
  })
}
