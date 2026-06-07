import { ObjectId } from 'mongodb'
import { getDb } from './mongo.js'

export const getOrders = async () => {
  const db = await getDb()
  return db.collection('orders').find({}).sort({ createdAt: -1 }).toArray()
}

export const getOrdersByUserId = async (userId) => {
  const db = await getDb()
  return db
    .collection('orders')
    .find({ userId, status: { $ne: 'Removed' } })
    .sort({ createdAt: -1 })
    .toArray()
}

export const createOrder = async (data) => {
  const db = await getDb()

  const now = new Date()
  const itemsWithTracking = (data.items || []).map((item) => {
    const initialStatus = 'Pending COD'
    return {
      ...item,
      trackingStatus: initialStatus,
      trackingEvents: [{ status: initialStatus, at: now }],
    }
  })

  const order = {
    status: 'Pending',
    createdAt: now,
    ...data,
    items: itemsWithTracking,
  }

  const result = await db.collection('orders').insertOne(order)
  return { ...order, _id: result.insertedId }
}


export const updateOrderStatus = async (id, status) => {
  const db = await getDb()
  const updated = await db.collection('orders').findOneAndUpdate(
    { _id: new ObjectId(id) },
    { $set: { status } },
    { returnDocument: 'after' }
  )
  return updated
}

export const removeOrderById = async (id) => {
  const db = await getDb()
  const removed = await db.collection('orders').findOneAndDelete({ _id: new ObjectId(id) })
  return removed
}

export const removeOrdersByUserId = async (userId) => {
  const db = await getDb()
  const removed = await db.collection('orders').find({ userId }).toArray()
  await db.collection('orders').deleteMany({ userId })
  return removed
}
