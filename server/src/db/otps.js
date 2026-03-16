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

export const getLatestOtpByEmail = async (email, type = 'register') => {
  const db = await getDb()
  return db
    .collection('otps')
    .find({ email, type })
    .sort({ createdAt: -1 })
    .limit(1)
    .next()
}

export const markOtpVerified = async (id) => {
  const db = await getDb()
  await db.collection('otps').updateOne({ id }, { $set: { verifiedAt: new Date() } })
  return true
}

export const incrementOtpAttempts = async (id) => {
  const db = await getDb()
  await db.collection('otps').updateOne({ id }, { $inc: { attempts: 1 } })
  return true
}

export const consumeOtp = async (id) => {
  const db = await getDb()
  await db.collection('otps').deleteOne({ id })
  return true
}
