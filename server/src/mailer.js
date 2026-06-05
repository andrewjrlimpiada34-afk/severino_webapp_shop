import nodemailer from 'nodemailer'
import { Resend } from 'resend'
import { config } from 'dotenv'

config()

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null
const resendFrom = process.env.RESEND_FROM || process.env.SMTP_EMAIL || ''

const info = await resend.emails.send({
  from: resendFrom,
  to,
  subject,
  text,
})

console.log('RESEND RESPONSE:', info)

const transporter =
  process.env.SMTP_EMAIL && process.env.SMTP_PASS
    ? nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: process.env.SMTP_EMAIL,
          pass: process.env.SMTP_PASS,
        },
      })
    : null

const canUseResend = () => !!(resend && resendFrom)
const canUseSmtp = () => !!transporter

export async function send_mail({ to, subject, text, pdfBuffer }) {
  try {
    if (canUseResend()) {
      const info = await resend.emails.send({
        from: resendFrom,
        to,
        subject,
        text,
        attachments: pdfBuffer
          ? [
              {
                filename: 'Schedule.pdf',
                content: pdfBuffer.toString('base64'),
              },
            ]
          : undefined,
      })
      return { success: true, messageId: info?.data?.id }
    }

    if (!canUseSmtp()) {
      throw new Error('Email service not configured')
    }

    const info = await transporter.sendMail({
      from: `"Severino Atelier" <${process.env.SMTP_EMAIL}>`,
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
    if (canUseResend()) {
      const info = await resend.emails.send({
        from: resendFrom,
        to,
        subject,
        text,
      })
      return { success: true, messageId: info?.data?.id }
    }

    if (!canUseSmtp()) {
      throw new Error('Email service not configured')
    }

    const info = await transporter.sendMail({
      from: `"Severino Atelier" <${process.env.SMTP_EMAIL}>`,
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
