import test from 'node:test'
import assert from 'node:assert/strict'
import { defaultBannerStories } from '../../shared/bannerContent.js'

test('banner video settings survive saving, readback, legacy edits, and explicit removal', async (context) => {
  // All queries are intercepted before any call; this test never opens a database connection.
  process.env.DATABASE_URL = 'postgresql://test:test@localhost:1/banner-test'
  const { getDb, closeDb } = await import('./postgres.js')
  const { getBannerStories, updateBannerStories } = await import('./banners.js')
  const settings = new Map([['banner_stories', JSON.stringify({ stories: defaultBannerStories })]])
  context.mock.method(getDb(), 'query', async (sql, values) => {
    if (sql.startsWith('SELECT setting_value')) return { rows: settings.has(values[0]) ? [{ setting_value: settings.get(values[0]) }] : [] }
    assert.match(sql, /^INSERT INTO app_settings/)
    settings.set(values[0], values[1])
    return { rows: [] }
  })
  context.after(closeDb)
  const stories = await getBannerStories()
  assert.equal(stories[4].videoUrl, '')
  stories[4].videoUrl = 'https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrStUvWxYz/view'
  await updateBannerStories(stories)
  assert.equal((await getBannerStories())[4].videoUrl, stories[4].videoUrl)
  const legacyEdit = stories.map(({ id, title }) => ({ id, title, message: 'Updated caption' }))
  await updateBannerStories(legacyEdit)
  assert.equal((await getBannerStories())[4].videoUrl, stories[4].videoUrl)
  const cleared = await getBannerStories()
  cleared[4].videoUrl = ''
  await updateBannerStories(cleared)
  assert.equal((await getBannerStories())[4].videoUrl, '')
  assert.equal((await getBannerStories())[4].message, 'Updated caption')
})
