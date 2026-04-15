import sharp from 'sharp'

export const isDataUrl = (value = '') => typeof value === 'string' && value.startsWith('data:')

export const assertNoDataUrls = (values = []) =>
  values.every((value) => !isDataUrl(value))

const DEFAULT_MAX_WIDTH = Number(process.env.UPLOAD_MAX_WIDTH || '1000')
const TARGET_MAX_KB = Number(process.env.UPLOAD_TARGET_MAX_KB || '400')
const TARGET_MIN_KB = Number(process.env.UPLOAD_TARGET_MIN_KB || '200')
const DEFAULT_FORMAT = (process.env.UPLOAD_FORMAT || 'webp').toLowerCase()
const START_QUALITY = Number(process.env.UPLOAD_START_QUALITY || '80')
const MIN_QUALITY = Number(process.env.UPLOAD_MIN_QUALITY || '50')

const pickFormat = (format) => {
  if (format === 'avif' || format === 'webp' || format === 'jpeg' || format === 'jpg') {
    return format === 'jpg' ? 'jpeg' : format
  }
  return 'webp'
}

const encodeImage = (pipeline, format, quality) => {
  if (format === 'avif') {
    return pipeline.avif({ quality, effort: 4 })
  }
  if (format === 'jpeg') {
    return pipeline.jpeg({ quality, mozjpeg: true })
  }
  return pipeline.webp({ quality, effort: 4 })
}

export const processImageBuffer = async (
  buffer,
  {
    maxWidth = DEFAULT_MAX_WIDTH,
    targetMaxKb = TARGET_MAX_KB,
    targetMinKb = TARGET_MIN_KB,
    format = DEFAULT_FORMAT,
  } = {}
) => {
  const targetMaxBytes = Math.max(10, targetMaxKb) * 1024
  const targetMinBytes = Math.max(10, targetMinKb) * 1024
  const outputFormat = pickFormat(format)

  let quality = START_QUALITY
  let output = null

  while (quality >= MIN_QUALITY) {
    const pipeline = sharp(buffer)
      .rotate()
      .resize({
        width: maxWidth,
        height: maxWidth,
        fit: 'inside',
        withoutEnlargement: true,
      })
    const encoded = encodeImage(pipeline, outputFormat, quality)
    const data = await encoded.toBuffer()

    output = { buffer: data, format: outputFormat, size: data.length, quality }
    if (data.length <= targetMaxBytes) break
    quality -= 10
  }

  if (!output) {
    return { buffer, format: outputFormat, size: buffer.length, quality: START_QUALITY }
  }

  if (output.size < targetMinBytes && output.quality < START_QUALITY) {
    const pipeline = sharp(buffer)
      .rotate()
      .resize({
        width: maxWidth,
        height: maxWidth,
        fit: 'inside',
        withoutEnlargement: true,
      })
    const encoded = encodeImage(pipeline, outputFormat, START_QUALITY)
    const data = await encoded.toBuffer()
    return { buffer: data, format: outputFormat, size: data.length, quality: START_QUALITY }
  }

  return output
}

export const buildCloudinaryTransformUrl = (
  secureUrl,
  { width = DEFAULT_MAX_WIDTH } = {}
) => {
  if (!secureUrl || typeof secureUrl !== 'string') return secureUrl
  const marker = '/upload/'
  const index = secureUrl.indexOf(marker)
  if (index === -1) return secureUrl
  const transform = `f_auto,q_auto,c_limit,w_${width}`
  return `${secureUrl.slice(0, index + marker.length)}${transform}/${secureUrl.slice(
    index + marker.length
  )}`
}
