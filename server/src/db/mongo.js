import { MongoClient } from 'mongodb'

const uri = process.env.MONGODB_URI
if (!uri) {
  throw new Error('MONGODB_URI is not set')
}

const client = new MongoClient(uri)
let db

export const getDb = async () => {
  if (!db) {
    await client.connect()
    db = client.db(process.env.MONGODB_DB || 'severino')
  }
  return db
}

export const closeDb = async () => {
  if (client) {
    await client.close()
    db = null
  }
}
