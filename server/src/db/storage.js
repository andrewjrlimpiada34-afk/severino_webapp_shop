import fs from 'fs'
import path from 'path'

const dataFile = path.join(process.cwd(), 'src', 'db', 'data.json')

const defaultData = {
  products: [],
  users: [],
  carts: [],
  orders: [],
  feedback: [],
  reviews: [],
  sales: [],
  banners: [],
  otps: [],
}

const ensureFile = () => {
  if (!fs.existsSync(dataFile)) {
    fs.writeFileSync(dataFile, JSON.stringify(defaultData, null, 2))
  }
}

export const loadData = () => {
  ensureFile()
  const raw = fs.readFileSync(dataFile, 'utf-8')
  return JSON.parse(raw)
}

export const saveData = (data) => {
  fs.writeFileSync(dataFile, JSON.stringify(data, null, 2))
}
