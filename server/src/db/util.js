import { randomBytes } from 'node:crypto'

export const createId = () => randomBytes(12).toString('hex')

export const parseJson = (value, fallback = null) => {
  if (value === null || value === undefined) return fallback
  if (typeof value !== 'string') return value
  try {
    return JSON.parse(value)
  } catch {
    return fallback
  }
}

export const nullable = (value) => {
  if (value === null || value === undefined) return null
  const normalized = String(value).trim()
  return normalized || null
}

export const normalizeId = (record) => {
  if (!record) return null
  const { _id, ...rest } = record
  return { ...rest, id: String(rest.id ?? _id) }
}

export const normalizeList = (records) => records.map(normalizeId)
