export const compressImageFile = async (
  file,
  { maxSize = 1600, quality = 0.82, outputType = 'image/jpeg' } = {}
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
