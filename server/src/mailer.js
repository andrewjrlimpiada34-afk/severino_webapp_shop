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
    name: mailFromName,
    to,
    subject,
    text,
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

  const body = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(body.message || body.error || 'Promailer send failed')
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
