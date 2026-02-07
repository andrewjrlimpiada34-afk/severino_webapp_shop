import { ObjectId } from 'mongodb'
import { getDb } from './mongo.js'

export const normalizeId = (doc) => {
  if (!doc) return null
  return { ...doc, id: doc._id?.toString?.() || doc.id }
}

export const normalizeList = (docs) => docs.map(normalizeId)

export const toObjectId = (id) => new ObjectId(id)
