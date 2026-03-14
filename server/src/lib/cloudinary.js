import { v2 as cloudinary } from 'cloudinary'

const resolveCloudinaryConfig = () => {
  if (process.env.CLOUDINARY_URL) {
    cloudinary.config({ secure: true })
    return
  }
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME
  const apiKey = process.env.CLOUDINARY_API_KEY
  const apiSecret = process.env.CLOUDINARY_API_SECRET
  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error('Cloudinary is not configured')
  }
  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
    secure: true,
  })
}

resolveCloudinaryConfig()

export const uploadBuffer = (buffer, options = {}) =>
  new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: options.folder || 'severino',
        resource_type: 'image',
      },
      (error, result) => {
        if (error) return reject(error)
        return resolve(result)
      }
    )
    stream.end(buffer)
  })
