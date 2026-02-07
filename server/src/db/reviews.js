import { ObjectId } from 'mongodb'
import { getDb } from './mongo.js'

export const getReviewsByProductId = async (productId) => {
  const db = await getDb()
  return db.collection('reviews').find({ productId }).sort({ createdAt: -1 }).toArray()
}

export const createReview = async (data) => {
  const db = await getDb()
  const entry = { ...data, createdAt: new Date() }
  const result = await db.collection('reviews').insertOne(entry)
  return { ...entry, _id: result.insertedId }
}

export const getReviewById = async (id) => {
  const db = await getDb()
  if (!ObjectId.isValid(id)) return null
  return db.collection('reviews').findOne({ _id: new ObjectId(id) })
}

export const deleteReview = async (id) => {
  const db = await getDb()
  if (!ObjectId.isValid(id)) return null
  const result = await db.collection('reviews').findOneAndDelete({
    _id: new ObjectId(id),
  })
  return result.value
}
