const normalizeSmsProvider = () => (process.env.SMS_PROVIDER || '').trim().toLowerCase()

export const isSmsConfigured = () => {
  const provider = normalizeSmsProvider()
  if (provider === 'semaphore') {
    return Boolean(process.env.SEMAPHORE_API_KEY)
  }
  return process.env.NODE_ENV !== 'production'
}

export const send_sms_otp = async ({ to, code }) => {
  const provider = normalizeSmsProvider()
  const message = `Your Severino verification code is ${code}. It expires in 5 minutes.`

  if (provider === 'semaphore') {
    const body = new URLSearchParams({
      apikey: process.env.SEMAPHORE_API_KEY,
      number: to,
      message,
    })

    if (process.env.SEMAPHORE_SENDER_NAME) {
      body.set('sendername', process.env.SEMAPHORE_SENDER_NAME)
    }

    const response = await fetch('https://api.semaphore.co/api/v4/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    })

    if (!response.ok) {
      throw new Error('SMS provider failed')
    }

    return { success: true }
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error('SMS service not configured')
  }

  console.info(`[DEV SMS OTP] ${to}: ${code}`)
  return { success: true, dev: true }
}
