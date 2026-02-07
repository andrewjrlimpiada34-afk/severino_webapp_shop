import { ObjectId } from 'mongodb'
import { getDb } from './mongo.js'

export const getOrders = async () => {
  const db = await getDb()
  return db.collection('orders').find({}).sort({ createdAt: -1 }).toArray()
}

export const getOrdersByUserId = async (userId) => {
  const db = await getDb()
  return db.collection('orders').find({ userId }).sort({ createdAt: -1 }).toArray()
}

export const createOrder = async (data) => {
  const db = await getDb()
  const order = {
    status: 'Pending',
    createdAt: new Date(),
    ...data,
  }
  const result = await db.collection('orders').insertOne(order)
  return { ...order, _id: result.insertedId }
}

export const updateOrderStatus = async (id, status) => {
  const db = await getDb()
  const result = await db.collection('orders').findOneAndUpdate(
    { _id: new ObjectId(id) },
    { $set: { status } },
    { returnDocument: 'after' }
  )
  return result.value
}

export const removeOrderById = async (id) => {
  const db = await getDb()
  const result = await db.collection('orders').findOneAndDelete({ _id: new ObjectId(id) })
  return result.value
}

export const removeOrdersByUserId = async (userId) => {
  const db = await getDb()
  const removed = await db.collection('orders').find({ userId }).toArray()
  await db.collection('orders').deleteMany({ userId })
  return removed
}
