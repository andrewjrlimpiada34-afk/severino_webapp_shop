import { getDb, withTransaction } from './postgres.js'
import { createId, parseJson } from './util.js'
import { defaultFaqs } from '../../shared/faqContent.js'

export const getFaqs = async () => {
  const { rows } = await getDb().query(
    'SELECT setting_value FROM app_settings WHERE setting_key = $1 LIMIT 1',
    ['faqs']
  )
  return parseJson(rows[0]?.setting_value, { items: defaultFaqs }).items
}

// Lock the settings row so simultaneous admins preserve each other's FAQ entries.
const changeFaqs = (change) => withTransaction(async (client) => {
  await client.query(
    `INSERT INTO app_settings (setting_key, setting_value)
     VALUES ($1, $2) ON CONFLICT (setting_key) DO NOTHING`,
    ['faqs', JSON.stringify({ items: defaultFaqs })]
  )
  const { rows } = await client.query(
    'SELECT setting_value FROM app_settings WHERE setting_key = $1 FOR UPDATE',
    ['faqs']
  )
  const { items, result } = change(parseJson(rows[0].setting_value).items)
  await client.query(
    `UPDATE app_settings SET setting_value = $2, updated_at = CURRENT_TIMESTAMP
     WHERE setting_key = $1`,
    ['faqs', JSON.stringify({ items })]
  )
  return result
})

export const createFaq = (data) => changeFaqs((items) => {
  const item = { id: createId(), question: data.question, answer: data.answer }
  return { items: [...items, item], result: item }
})

export const updateFaq = (id, data) => changeFaqs((items) => {
  const existing = items.find((item) => item.id === id)
  const updated = existing ? { id, question: data.question, answer: data.answer } : null
  return {
    items: items.map((item) => item.id === id ? updated : item),
    result: updated,
  }
})

export const deleteFaq = (id) => changeFaqs((items) => ({
  items: items.filter((item) => item.id !== id),
  result: items.some((item) => item.id === id),
}))
