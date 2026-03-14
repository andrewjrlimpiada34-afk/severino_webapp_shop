import express from 'express'
import multer from 'multer'
import { requireAuth } from '../middleware/auth.js'
import { uploadBuffer } from '../lib/cloudinary.js'

const router = express.Router()

const MAX_UPLOAD_MB = Number(process.env.MAX_UPLOAD_MB || '4')
const MAX_UPLOAD_BYTES = Math.max(1, MAX_UPLOAD_MB) * 1024 * 1024

const storage = multer.memoryStorage()
const upload = multer({
  storage,
  limits: { fileSize: MAX_UPLOAD_BYTES },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype || !file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image uploads are allowed'))
    }
    return cb(null, true)
  },
})

router.post('/image', requireAuth, upload.single('image'), async (req, res) => {
  try {
    if (!req.file?.buffer) {
      return res.status(400).json({ message: 'Image is required' })
    }
    const result = await uploadBuffer(req.file.buffer)
    return res.json({ url: result.secure_url })
  } catch (error) {
    const message =
      error?.message?.includes('File too large') || error?.code === 'LIMIT_FILE_SIZE'
        ? `Image too large. Max ${MAX_UPLOAD_MB}MB`
        : error?.message || 'Upload failed'
    return res.status(400).json({ message })
  }
})

router.use((err, req, res, next) => {
  if (!err) return next()
  const message =
    err?.code === 'LIMIT_FILE_SIZE'
      ? `Image too large. Max ${MAX_UPLOAD_MB}MB`
      : err?.message || 'Upload failed'
  return res.status(400).json({ message })
})

export default router
