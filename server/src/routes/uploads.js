import express from 'express'
import multer from 'multer'
import { requireAuth } from '../middleware/auth.js'
import { deleteCloudinaryAsset, uploadBuffer } from '../lib/cloudinary.js'
import { buildCloudinaryTransformUrl, processImageBuffer } from '../lib/images.js'

const router = express.Router()

const MAX_UPLOAD_MB = Number(process.env.MAX_UPLOAD_MB || '4')
const MAX_UPLOAD_BYTES = Math.max(1, MAX_UPLOAD_MB) * 1024 * 1024
const MAX_MEDIA_UPLOAD_MB = Number(process.env.MAX_MEDIA_UPLOAD_MB || '15')
const MAX_MEDIA_UPLOAD_BYTES = Math.max(1, MAX_MEDIA_UPLOAD_MB) * 1024 * 1024
const MAX_VIDEO_DURATION_SECONDS = 30

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

const mediaUpload = multer({
  storage,
  limits: { fileSize: MAX_MEDIA_UPLOAD_BYTES },
  fileFilter: (req, file, cb) => {
    const isImage = file.mimetype?.startsWith('image/')
    const isSupportedVideo = ['video/mp4', 'video/webm', 'video/quicktime'].includes(file.mimetype)
    if (!isImage && !isSupportedVideo) {
      return cb(new Error('Only images, MP4, WebM, or MOV videos are allowed'))
    }
    return cb(null, true)
  },
})

router.post('/image', requireAuth, upload.single('image'), async (req, res) => {
  try {
    if (!req.file?.buffer) {
      return res.status(400).json({ message: 'Image is required' })
    }
    const processed = await processImageBuffer(req.file.buffer)
    const result = await uploadBuffer(processed.buffer)
    const optimizedUrl = buildCloudinaryTransformUrl(result.secure_url)
    return res.json({
      url: optimizedUrl,
      rawUrl: result.secure_url,
      bytes: processed.size,
      format: processed.format,
    })
  } catch (error) {
    const message =
      error?.message?.includes('File too large') || error?.code === 'LIMIT_FILE_SIZE'
        ? `Image too large. Max ${MAX_UPLOAD_MB}MB`
        : error?.message || 'Upload failed'
    return res.status(400).json({ message })
  }
})

router.post('/media', requireAuth, mediaUpload.single('media'), async (req, res) => {
  try {
    if (!req.file?.buffer) {
      return res.status(400).json({ message: 'Media file is required' })
    }

    const isVideo = req.file.mimetype.startsWith('video/')
    if (isVideo) {
      const result = await uploadBuffer(req.file.buffer, {
        folder: 'severino/customer-media',
        resourceType: 'video',
      })
      if (Number(result.duration || 0) > MAX_VIDEO_DURATION_SECONDS) {
        await deleteCloudinaryAsset(result.public_id, 'video').catch(() => null)
        return res.status(400).json({
          message: `Video must be ${MAX_VIDEO_DURATION_SECONDS} seconds or shorter`,
        })
      }
      return res.json({
        url: result.secure_url,
        mediaType: 'video',
        bytes: result.bytes || req.file.size,
        duration: result.duration || 0,
      })
    }

    const processed = await processImageBuffer(req.file.buffer)
    const result = await uploadBuffer(processed.buffer, {
      folder: 'severino/customer-media',
    })
    return res.json({
      url: buildCloudinaryTransformUrl(result.secure_url),
      mediaType: 'image',
      bytes: processed.size,
      format: processed.format,
    })
  } catch (error) {
    const message =
      error?.message?.includes('File too large') || error?.code === 'LIMIT_FILE_SIZE'
        ? `Media too large. Max ${MAX_MEDIA_UPLOAD_MB}MB`
        : error?.message || 'Media upload failed'
    return res.status(400).json({ message })
  }
})

router.use((err, req, res, next) => {
  if (!err) return next()
  const message =
    err?.code === 'LIMIT_FILE_SIZE'
      ? `File too large. Images allow ${MAX_UPLOAD_MB}MB; attached media allows ${MAX_MEDIA_UPLOAD_MB}MB`
      : err?.message || 'Upload failed'
  return res.status(400).json({ message })
})

export default router
