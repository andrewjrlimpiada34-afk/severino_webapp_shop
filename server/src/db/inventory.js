import { getDb } from './mongo.js'

export const recordSale = async (orderId, total) => {
  const db = await getDb()
  const entry = { orderId, total, createdAt: new Date() }
  await db.collection('sales').insertOne(entry)
  return entry
}

export const getSalesSummary = async () => {
  const db = await getDb()
  const sales = await db.collection('sales').find({}).toArray()
  return {
    count: sales.length,
    revenue: sales.reduce((sum, item) => sum + (item.total || 0), 0),
  }
}
