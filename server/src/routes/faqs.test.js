import test from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'
import jwt from 'jsonwebtoken'
import { defaultFaqs } from '../../shared/faqContent.js'
import { errorHandler } from '../middleware/error.js'

test('FAQ publishing preserves saved content and restricts management to admins', async (context) => {
  process.env.DATABASE_URL = 'postgresql://test:test@localhost:1/faq-test'
  process.env.JWT_SECRET = 'faq-tests-only-key'
  process.env.NODE_ENV = 'production'
  const { getDb, closeDb } = await import('../db/postgres.js')
  let stored
  let failWrite = false
  let transactionQueue = Promise.resolve()
  const queries = []

  context.mock.method(getDb(), 'query', async (sql, values) => {
    if (sql.startsWith('SELECT * FROM users')) return { rows: [{ id: values[0], role: values[0].startsWith('admin') ? 'admin' : 'customer', verified: true }] }
    queries.push(sql)
    assert.match(sql, /^SELECT setting_value/)
    assert.deepEqual(values, ['faqs'])
    return { rows: stored ? [{ setting_value: structuredClone(stored) }] : [] }
  })
  context.mock.method(getDb(), 'connect', async () => {
    const previous = transactionQueue
    let release
    transactionQueue = new Promise((resolve) => { release = resolve })
    await previous
    let next = structuredClone(stored)
    return {
      release,
      query: async (sql, values) => {
        queries.push(sql)
        if (sql === 'BEGIN' || sql === 'ROLLBACK') return { rows: [] }
        if (sql === 'COMMIT') {
          stored = next
          return { rows: [] }
        }
        assert.equal(values[0], 'faqs')
        if (sql.startsWith('INSERT INTO app_settings')) {
          assert.match(sql, /ON CONFLICT \(setting_key\) DO NOTHING/)
          next ??= JSON.parse(values[1])
          return { rows: [] }
        }
        if (sql.startsWith('SELECT setting_value')) {
          assert.match(sql, /FOR UPDATE$/)
          return { rows: [{ setting_value: structuredClone(next) }] }
        }
        assert.match(sql, /^UPDATE app_settings/)
        if (failWrite) throw new Error('Simulated FAQ write failure')
        next = JSON.parse(values[1])
        return { rows: [] }
      },
    }
  })
  context.mock.method(console, 'error', () => {})
  const { default: adminRoutes } = await import('./admin.js')
  const { default: publicRoutes } = await import('./public.js')
  const app = express()
  app.use(express.json())
  app.use('/api/admin', adminRoutes)
  app.use('/api/public', publicRoutes)
  app.use(errorHandler)
  const server = await new Promise((resolve) => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance))
  })
  context.after(async () => {
    server.closeAllConnections()
    await new Promise((resolve) => server.close(resolve))
    await closeDb()
  })
  const base = `http://127.0.0.1:${server.address().port}`
  const tokens = Object.fromEntries(['admin', 'customer'].map((role) => [
    role, jwt.sign({ id: `${role}-faq-test`, role }, process.env.JWT_SECRET),
  ]))
  const request = (path, method = 'GET', body, role = 'admin') => fetch(`${base}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(tokens[role] ? { Authorization: `Bearer ${tokens[role]}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(5000),
  })
  const readPublic = () => request('/api/public/faqs', 'GET', undefined, 'guest')
  const data = { question: '  Can I ask a question?  ', answer: '  Yes.\nContact the store.  ' }

  await context.test('guests read starter FAQs without initializing or replacing database content', async () => {
    const response = await readPublic()
    assert.equal(response.status, 200)
    assert.equal(response.headers.get('Cache-Control'), 'no-store')
    assert.deepEqual(await response.json(), defaultFaqs)
    assert.equal(stored, undefined)
    assert.equal(queries.some((sql) => sql.includes('INSERT') || sql.includes('UPDATE')), false)
  })

  await context.test('every management operation checks authentication and admin role', async () => {
    const before = queries.length
    for (const role of ['guest', 'customer']) {
      for (const [method, path] of [
        ['GET', '/api/admin/faqs'], ['POST', '/api/admin/faqs'],
        ['PUT', '/api/admin/faqs/placing-an-order'], ['DELETE', '/api/admin/faqs/placing-an-order'],
      ]) {
        const response = await request(path, method, method === 'POST' || method === 'PUT' ? data : undefined, role)
        assert.equal(response.status, role === 'guest' ? 401 : 403)
      }
    }
    assert.equal(queries.length, before)
  })

  await context.test('invalid and whitespace-only answers never reach storage', async () => {
    const before = queries.length
    for (const invalid of [
      {}, null, { question: ' ', answer: 'valid' }, { question: 'valid', answer: '\n ' },
      { question: 'x'.repeat(201), answer: 'valid' }, { question: 'valid', answer: 'x'.repeat(3001) },
      { question: 123, answer: 'valid' },
    ]) {
      assert.equal((await request('/api/admin/faqs', 'POST', invalid)).status, 400)
      assert.equal((await request('/api/admin/faqs/placing-an-order', 'PUT', invalid)).status, 400)
    }
    assert.equal(queries.length, before)
  })

  let created
  await context.test('created and edited FAQs publish immediately and retain stable IDs', async () => {
    const response = await request('/api/admin/faqs', 'POST', { ...data, id: 'untrusted-id', published: false })
    assert.equal(response.status, 201)
    created = await response.json()
    assert.match(created.id, /^[a-f0-9]{24}$/)
    assert.equal(created.question, data.question.trim())
    assert.equal(created.answer, data.answer.trim())
    assert.deepEqual(Object.keys(created).sort(), ['answer', 'id', 'question'])
    let items = await (await readPublic()).json()
    assert.equal(items.length, defaultFaqs.length + 1)
    assert.deepEqual(items.at(-1), created)
    const edited = await request(`/api/admin/faqs/${created.id}`, 'PUT', { question: 'Updated question?', answer: 'Updated answer.' })
    assert.equal(edited.status, 200)
    assert.deepEqual(await edited.json(), { id: created.id, question: 'Updated question?', answer: 'Updated answer.' })
    items = await (await readPublic()).json()
    assert.equal(items.length, defaultFaqs.length + 1)
    assert.equal(items.at(-1).answer, 'Updated answer.')
    assert.deepEqual(await (await request('/api/admin/faqs')).json(), items)
  })

  await context.test('independent concurrent edits preserve both changes and other entries', async () => {
    const [first, second] = defaultFaqs
    const responses = await Promise.all([
      request(`/api/admin/faqs/${first.id}`, 'PUT', { question: first.question, answer: 'First admin answer.' }),
      request(`/api/admin/faqs/${second.id}`, 'PUT', { question: second.question, answer: 'Second admin answer.' }),
    ])
    assert.deepEqual(responses.map((response) => response.status), [200, 200])
    const items = await (await readPublic()).json()
    assert.equal(items.find((item) => item.id === first.id).answer, 'First admin answer.')
    assert.equal(items.find((item) => item.id === second.id).answer, 'Second admin answer.')
    assert.equal(items.length, defaultFaqs.length + 1)
  })

  await context.test('failed writes roll back and allow a successful retry', async () => {
    const before = structuredClone(stored)
    failWrite = true
    assert.equal((await request(`/api/admin/faqs/${created.id}`, 'DELETE')).status, 500)
    assert.deepEqual(stored, before)
    assert.equal(queries.at(-1), 'ROLLBACK')
    failWrite = false
    assert.equal((await request(`/api/admin/faqs/${created.id}`, 'DELETE')).status, 200)
    assert.equal((await (await readPublic()).json()).some((item) => item.id === created.id), false)
    assert.equal((await request(`/api/admin/faqs/${created.id}`, 'PUT', data)).status, 404)
    assert.equal((await request(`/api/admin/faqs/${created.id}`, 'DELETE')).status, 404)
  })

  await context.test('deleting all FAQs preserves an empty list across subsequent reads', async () => {
    for (const item of defaultFaqs) {
      assert.equal((await request(`/api/admin/faqs/${item.id}`, 'DELETE')).status, 200)
    }
    assert.deepEqual(await (await readPublic()).json(), [])
    assert.deepEqual(await (await readPublic()).json(), [])
    assert.deepEqual(stored.items, [])
  })
})
