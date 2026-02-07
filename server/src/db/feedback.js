import { getDb } from './mongo.js'

export const getFeedback = async () => {
  const db = await getDb()
  return db.collection('feedback').find({}).sort({ createdAt: -1 }).toArray()
}

export const createFeedback = async (data) => {
  const db = await getDb()
  const entry = { ...data, createdAt: new Date() }
  const result = await db.collection('feedback').insertOne(entry)
  return { ...entry, _id: result.insertedId }
}
