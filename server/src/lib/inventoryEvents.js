import { EventEmitter } from 'node:events'
import { randomUUID } from 'node:crypto'
import { getDb } from '../db/postgres.js'
import { createCache } from './cache.js'

export const inventoryCache = createCache(20000)
export const inventoryEvents = new EventEmitter()
inventoryEvents.setMaxListeners(0)
const seen = new Set()
let listener
let reconnectTimer
let stopping = false

export const inventoryChange = (products) => ({ id: randomUUID(), products: Array.from(new Map(products.map((product) => [product.id, product])).values()) })

export function publishInventoryChange(event) {
  if (!event || !Array.isArray(event.products) || seen.has(event.id)) return
  seen.add(event.id)
  if (seen.size > 200) seen.delete(seen.values().next().value)
  inventoryCache.clear()
  inventoryEvents.emit('change', event)
}

export async function notifyInventoryChange(connection, event) {
  await connection.query("SELECT pg_notify('severino_inventory', $1)", [JSON.stringify(event)])
}

export async function startInventoryListener() {
  stopping = false
  if (listener) return
  try {
    const client = await getDb().connect()
    if (stopping) { client.release(); return }
    listener = client
    client.on('notification', (message) => {
      if (message.channel !== 'severino_inventory') return
      try { publishInventoryChange(JSON.parse(message.payload)) } catch { /* Ignore malformed notifications. */ }
    })
    client.once('error', () => {
      if (listener !== client) return
      listener = undefined
      client.release(true)
      if (!stopping) {
        reconnectTimer = setTimeout(startInventoryListener, 5000)
        reconnectTimer.unref()
      }
    })
    await client.query('LISTEN severino_inventory')
    publishInventoryChange(inventoryChange([]))
  } catch {
    if (listener) { listener.release(true); listener = undefined }
    if (!stopping) {
      reconnectTimer = setTimeout(startInventoryListener, 5000)
      reconnectTimer.unref()
    }
  }
}

export function stopInventoryListener() {
  stopping = true
  inventoryEvents.emit('shutdown')
  clearTimeout(reconnectTimer)
  if (listener) { listener.release(true); listener = undefined }
}
