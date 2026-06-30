import nodemailer from 'nodemailer'
import { config } from 'dotenv'

config()

const smtpEmail = process.env.SMTP_EMAIL || process.env.GMAIL_USER || ''
const smtpPass = process.env.SMTP_PASS || process.env.GMAIL_APP_PASSWORD || ''
const mailFromName = process.env.MAIL_FROM_NAME || 'Severino Atelier'
const promailerApiUrl = process.env.PROMAILER_API_URL || ''
const promailerApiKey = process.env.PROMAILER_API_KEY || ''
const promailerFrom =
  process.env.PROMAILER_FROM || process.env.SMTP_EMAIL || process.env.GMAIL_USER || ''
const promailerAuthScheme = process.env.PROMAILER_AUTH_SCHEME || 'Bearer'
const promailerSmtpConnectionId = process.env.PROMAILER_SMTP_CONNECTION_ID || ''

const transporter =
  smtpEmail && smtpPass
    ? nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: smtpEmail,
          pass: smtpPass,
        },
      })
    : null

const canUseSmtp = () => !!transporter
const canUsePromailer = () => Boolean(promailerApiUrl && promailerApiKey)

const sendWithPromailer = async ({ to, subject, text, pdfBuffer }) => {
  const payload = {
    from: promailerFrom,
    fromName: mailFromName,
    name: mailFromName,
    to,
    subject,
    text,
    body: text,
    html: text.replace(/\n/g, '<br />'),
  }

  if (promailerSmtpConnectionId) {
    payload.smtpConnectionId = promailerSmtpConnectionId
    payload.smtp_connection_id = promailerSmtpConnectionId
    payload.connectionId = promailerSmtpConnectionId
    payload.connection_id = promailerSmtpConnectionId
  }

  if (pdfBuffer) {
    payload.attachments = [
      {
        filename: 'Schedule.pdf',
        content: pdfBuffer.toString('base64'),
        contentType: 'application/pdf',
      },
    ]
  }

  const response = await fetch(promailerApiUrl, {
    method: 'POST',
    headers: {
      Authorization: `${promailerAuthScheme} ${promailerApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  const rawBody = await response.text().catch(() => '')
  let body = {}
  try {
    body = rawBody ? JSON.parse(rawBody) : {}
  } catch {
    body = { message: rawBody }
  }

  if (!response.ok) {
    const message =
      body.message ||
      body.error ||
      body.errors?.[0]?.message ||
      `Promailer send failed (${response.status})`
    console.error('Promailer send failed:', {
      status: response.status,
      statusText: response.statusText,
      response: body,
    })
    throw new Error(message)
  }

  return {
    success: true,
    messageId: body.messageId || body.id || body.data?.id || '',
  }
}

export async function send_mail({ to, subject, text, pdfBuffer }) {
  try {
    if (canUsePromailer()) {
      return await sendWithPromailer({ to, subject, text, pdfBuffer })
    }

    if (!canUseSmtp()) {
      throw new Error('Email service not configured')
    }

    const info = await transporter.sendMail({
      from: `"${mailFromName}" <${smtpEmail}>`,
      to,
      subject,
      text,
      attachments: pdfBuffer
        ? [
            {
              filename: 'Schedule.pdf',
              content: pdfBuffer,
              contentType: 'application/pdf',
            },
          ]
        : [],
    })

    return { success: true, messageId: info.messageId }
  } catch (error) {
    console.error('Email failed:', error)
    return { success: false, error }
  }
}

export async function send_otp({ to, subject, text }) {
  try {
    if (canUsePromailer()) {
      return await sendWithPromailer({ to, subject, text })
    }

    if (!canUseSmtp()) {
      throw new Error('Email service not configured')
    }

    const info = await transporter.sendMail({
      from: `"${mailFromName}" <${smtpEmail}>`,
      to,
      subject,
      text,
    })

    return { success: true, messageId: info.messageId }
  } catch (error) {
    console.error('Email failed:', error)
    return { success: false, error }
  }
}
