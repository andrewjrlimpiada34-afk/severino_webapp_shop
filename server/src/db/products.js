import { ObjectId } from 'mongodb'
import { getDb } from './mongo.js'

const seedProducts = [
  'Cucumber Melon',
  'Cloudy Scent',
  'Bacc540',
  'Burberry Weekend',
  'VelvetPetals',
  'LacosteRed',
  'Sauvage',
  'PoloSport',
  'LacosteWhite',
  'LacosteBlack',
  'CHGoodGirl',
  'MsDior',
  'TheBestScent',
  'StrongRed',
  'LanvinEclat',
]

const sizes = ['70ml', '80ml', '90ml', '100ml']
const categories = ['Men', 'Women', 'Unisex']

const seed = () =>
  seedProducts.map((name, index) => ({
    name,
    price: 300,
    stock: 10 + (index % 5) * 4,
    notes: 'Signature blend',
    description: 'A refined scent with balanced top, heart, and base notes.',
    imageUrls: ['', '', '', ''],
    size: sizes[index % sizes.length],
    category: categories[index % categories.length],
    active: true,
    createdAt: new Date(),
  }))

const ensureSeeded = async () => {
  const db = await getDb()
  const products = db.collection('products')
  const count = await products.countDocuments()
  if (count === 0) {
    await products.insertMany(seed())
  }
}

export const getProducts = async () => {
  await ensureSeeded()
  const db = await getDb()
  return db.collection('products').find({}).toArray()
}

export const getProductById = async (id) => {
  if (!id) return null
  await ensureSeeded()
  const db = await getDb()
  if (ObjectId.isValid(id)) {
    return db.collection('products').findOne({ _id: new ObjectId(id) })
  }
  return db.collection('products').findOne({ id })
}

export const createProduct = async (data) => {
  const db = await getDb()
  const products = db.collection('products')
  const product = {
    size: data.size || '100ml',
    description: data.description || '',
    imageUrls: data.imageUrls || [data.imageUrl || '', data.imageUrl2 || '', '', ''],
    category: data.category || 'Unisex',
    createdAt: new Date(),
    ...data,
  }
  const result = await products.insertOne(product)
  return { ...product, _id: result.insertedId }
}

export const updateProduct = async (id, data) => {
  const db = await getDb()
  const products = db.collection('products')
  if (ObjectId.isValid(id)) {
    const result = await products.findOneAndUpdate(
      { $or: [{ _id: new ObjectId(id) }, { id }] },
      { $set: data },
      { returnDocument: 'after' }
    )
    return result.value
  }
  const result = await products.findOneAndUpdate(
    { id },
    { $set: data },
    { returnDocument: 'after' }
  )
  return result.value
}

export const decrementStock = async (id, quantity) => {
  const db = await getDb()
  const products = db.collection('products')
  if (ObjectId.isValid(id)) {
    const result = await products.findOneAndUpdate(
      { _id: new ObjectId(id) },
      { $inc: { stock: -quantity } },
      { returnDocument: 'after' }
    )
    return result.value
  }
  const result = await products.findOneAndUpdate(
    { id },
    { $inc: { stock: -quantity } },
    { returnDocument: 'after' }
  )
  return result.value
}
