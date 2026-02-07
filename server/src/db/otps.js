import { getDb } from './mongo.js'

export const getOtpById = async (id) => {
  const db = await getDb()
  return db.collection('otps').findOne({ id })
}

export const createOtp = async (data) => {
  const db = await getDb()
  const entry = { ...data, createdAt: new Date() }
  await db.collection('otps').insertOne(entry)
  return entry
}

export const consumeOtp = async (id) => {
  const db = await getDb()
  await db.collection('otps').deleteOne({ id })
  return true
}
