export const defaultBannerStories = [
  { id: 'banner-1', title: 'Severino Perfume Tips', message: '' },
  { id: 'banner-2', title: 'Severino Inspiration', message: '' },
  { id: 'banner-3', title: 'Severino Stories', message: '' },
  { id: 'banner-4', title: 'Severino Scents', message: '' },
  { id: 'banner-5', title: 'Why Severino?', message: '' },
]

export function googleDriveVideo(value) {
  if (typeof value !== 'string' || value.length > 2000) return null
  try {
    const url = new URL(value.trim())
    if (url.protocol !== 'https:' || !['drive.google.com', 'www.drive.google.com'].includes(url.hostname) || url.username || url.password || url.port) return null
    const fileMatch = url.pathname.match(/^\/file\/(?:u\/\d+\/)?d\/([\w-]+)(?:\/(?:view|preview|edit))?\/?$/)
    const fileId = fileMatch?.[1] || (['/open', '/uc'].includes(url.pathname) ? url.searchParams.get('id') : '')
    if (!fileId || !/^[\w-]{10,200}$/.test(fileId)) return null
    const preview = new URL(`https://drive.google.com/file/d/${fileId}/preview`)
    const share = new URL(`https://drive.google.com/file/d/${fileId}/view`)
    const resourceKey = url.searchParams.get('resourcekey')
    if (resourceKey && /^[\w-]{1,200}$/.test(resourceKey)) {
      preview.searchParams.set('resourcekey', resourceKey)
      share.searchParams.set('resourcekey', resourceKey)
    }
    return { fileId, embedUrl: preview.href, shareUrl: share.href }
  } catch {
    return null
  }
}

export function normalizeBannerStories(stories = []) {
  return defaultBannerStories.map((base, index) => {
    const current = Array.isArray(stories) ? stories[index] || {} : {}
    return {
      ...base,
      message: typeof current.message === 'string' ? current.message : '',
      videoUrl: index === 4 && googleDriveVideo(current.videoUrl) ? current.videoUrl.trim() : '',
    }
  })
}

export function groupProductsByNote(products = []) {
  const groups = new Map()
  for (const product of Array.isArray(products) ? products : []) {
    if (!product?.id || product.active === false) continue
    const notes = typeof product.notes === 'string' ? product.notes.split(/[,;\n]+/) : []
    const seen = new Set()
    for (const rawNote of notes) {
      const name = rawNote.trim().replace(/\s+/g, ' ')
      const key = name.toLowerCase()
      if (!name || seen.has(key)) continue
      seen.add(key)
      if (!groups.has(key)) groups.set(key, { key, name, products: [] })
      groups.get(key).products.push(product)
    }
  }
  return Array.from(groups.values()).sort((first, second) => first.name.localeCompare(second.name, 'en', { sensitivity: 'base' }))
}
