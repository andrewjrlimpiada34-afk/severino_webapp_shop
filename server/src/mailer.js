import nodemailer from 'nodemailer'
import { config } from 'dotenv'

config()

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.SMTP_EMAIL,
    pass: process.env.SMTP_PASS,
  },
})

export async function send_mail({ to, subject, text, pdfBuffer }) {
  try {
    const info = await transporter.sendMail({
      from: `"MarSU SchedIt" <${process.env.SMTP_EMAIL}>`,
      to,
      subject,
      text,
      attachments: [{
        filename: 'Schedule.pdf',
        content: pdfBuffer,
        contentType: 'application/pdf',
      }],
    })

    console.log('Email sent:', info.messageId)
    return { success: true, messageId: info.messageId }
  } catch (error) {
    console.error('Email failed:', error)
    return { success: false, error }
  }
}

export async function send_otp({ to, subject, text }) {
  try {
    const info = await transporter.sendMail({
      from: `"MarSU SchedIt" <${process.env.SMTP_EMAIL}>`,
      to,
      subject,
      text,
    })

    console.log('Email sent:', info.messageId)
    return { success: true, messageId: info.messageId }
  } catch (error) {
    console.error('Email failed:', error)
    return { success: false, error }
  }
}
