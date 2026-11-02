import { useSyncExternalStore } from 'react'
import { api, API_URL } from '../lib/api.js'
import { createInventoryStore } from '../lib/inventoryStore.js'

const inventory = createInventoryStore({
  loadProducts: () => api.products({ fresh: true }),
  createSource: () => new EventSource(`${API_URL}/api/products/stock-events`),
  eventTarget: window,
  documentTarget: document,
})

export default function useInventoryStock() {
  return useSyncExternalStore(inventory.subscribe, inventory.getSnapshot, inventory.getSnapshot)
}
