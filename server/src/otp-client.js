// Only the backend can call the Python OTP service. Never expose this key to React.
export async function callOtp(path, payload) {
  const url = process.env.OTP_SERVICE_URL
  const key = process.env.OTP_SERVICE_KEY
  if (!url || !key) {
    return { status: 503, body: { message: 'OTP service not configured' } }
  }
  try {
    const response = await fetch(`${url.replace(/\/+$/, '')}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(90000),
    })
    const body = await response.json()
    return { status: response.status, body }
  } catch {
    return { status: 502, body: { message: 'OTP service unavailable. Please try again.' } }
  }
}

export const proxyOtp = (path) => async (req, res) => {
  const result = await callOtp(path, { ...req.body, clientIp: req.ip || 'unknown' })
  return res.status(result.status).json(result.body)
}
