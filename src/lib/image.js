export const compressImageFile = async (
  file,
  { maxSize = 1600, quality = 0.82, outputType = 'image/webp' } = {}
) => {
  const loadImage = () =>
    new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file)
      const img = new Image()
      img.onload = () => {
        URL.revokeObjectURL(url)
        resolve(img)
      }
      img.onerror = (error) => {
        URL.revokeObjectURL(url)
        reject(error)
      }
      img.src = url
    })

  const image = await loadImage()
  const width = image.naturalWidth || image.width
  const height = image.naturalHeight || image.height
  const scale = Math.min(1, maxSize / Math.max(width, height))
  const targetWidth = Math.max(1, Math.round(width * scale))
  const targetHeight = Math.max(1, Math.round(height * scale))

  const canvas = document.createElement('canvas')
  canvas.width = targetWidth
  canvas.height = targetHeight
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    return file
  }

  ctx.drawImage(image, 0, 0, targetWidth, targetHeight)

  const blob = await new Promise((resolve) =>
    canvas.toBlob(resolve, outputType, quality)
  )
  return blob || file
}

const CLOUDINARY_MARKER = '/upload/'

export const buildCloudinaryUrl = (url, { width = 1000 } = {}) => {
  if (!url || typeof url !== 'string') return url
  const index = url.indexOf(CLOUDINARY_MARKER)
  if (index === -1) return url
  const transform = `f_auto,q_auto,c_limit,w_${width}`
  return `${url.slice(0, index + CLOUDINARY_MARKER.length)}${transform}/${url.slice(
    index + CLOUDINARY_MARKER.length
  )}`
}

export const buildCloudinarySrcSet = (
  url,
  widths = [320, 480, 640, 800, 1000]
) => {
  if (!url || typeof url !== 'string') return ''
  if (!url.includes(CLOUDINARY_MARKER)) return ''
  return widths
    .map((width) => `${buildCloudinaryUrl(url, { width })} ${width}w`)
    .join(', ')
}
