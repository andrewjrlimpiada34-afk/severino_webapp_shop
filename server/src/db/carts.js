import { ObjectId } from 'mongodb'
import { getDb } from './mongo.js'

export const getCartByUserId = async (userId) => {
  const db = await getDb()
  return db.collection('carts').findOne({ userId })
}

export const createCart = async (userId) => {
  const db = await getDb()
  const cart = { userId, items: [], createdAt: new Date() }
  const result = await db.collection('carts').insertOne(cart)
  return { ...cart, _id: result.insertedId }
}

export const updateCart = async (userId, items) => {
  const db = await getDb()
  const result = await db.collection('carts').findOneAndUpdate(
    { userId },
    { $set: { items } },
    { returnDocument: 'after' }
  )
  return result.value
}

export const removeCartByUserId = async (userId) => {
  const db = await getDb()
  await db.collection('carts').deleteOne({ userId })
  return true
}
