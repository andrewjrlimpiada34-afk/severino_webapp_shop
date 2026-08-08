export const errorHandler = (error, req, res, next) => {
  if (res.headersSent) return next(error)

  const requestedStatus = Number(error.statusCode || error.status)
  const status = requestedStatus >= 400 && requestedStatus < 600 ? requestedStatus : 500
  console.error({
    method: req.method,
    path: req.originalUrl,
    status,
    message: error.message,
    ...(process.env.NODE_ENV === 'production' ? {} : { stack: error.stack }),
  })

  return res.status(status).json({
    message: status < 500 ? error.message : 'Internal server error',
  })
}
