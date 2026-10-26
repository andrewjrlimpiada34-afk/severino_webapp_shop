import test from 'node:test'
import assert from 'node:assert/strict'
import { defaultBannerStories, googleDriveVideo, groupProductsByNote, normalizeBannerStories } from './bannerContent.js'
import { bannerStoriesSchema } from '../src/lib/bannerStorySchema.js'

const fileId = '1AbCdEfGhIjKlMnOpQrStUvWxYz_012345'
const driveUrl = `https://drive.google.com/file/d/${fileId}/view?usp=sharing&resourcekey=0-sharedKey`

test('Google Drive links produce a trusted preview and retain resource keys', () => {
  assert.equal(googleDriveVideo(driveUrl).embedUrl, `https://drive.google.com/file/d/${fileId}/preview?resourcekey=0-sharedKey`)
  for (const url of [
    `https://drive.google.com/open?id=${fileId}`,
    `https://drive.google.com/uc?export=download&id=${fileId}`,
    `https://drive.google.com/file/d/${fileId}/preview`,
    `https://drive.google.com/file/u/0/d/${fileId}/view`,
  ]) assert.equal(googleDriveVideo(url).fileId, fileId)
  for (const url of [
    '', 'javascript:alert(1)', `http://drive.google.com/file/d/${fileId}/view`,
    `https://drive.google.com.evil.example/file/d/${fileId}/view`,
    `https://user@drive.google.com/file/d/${fileId}/view`,
    `https://drive.google.com:444/file/d/${fileId}/view`,
    `https://drive.google.com/drive/folders/${fileId}`, 'https://example.com/video.mp4',
  ]) assert.equal(googleDriveVideo(url), null)
})

test('notes group current active products, normalize spacing and case, and avoid duplicates', () => {
  const first = { id: 'one', name: 'First scent', notes: ' Citrus, Musk, citrus ;  White   Tea ' }
  const second = { id: 'two', name: 'Second scent', notes: 'citrus\nVanilla' }
  const groups = groupProductsByNote([first, second, { id: 'hidden', notes: 'Hidden', active: false }, { id: 'empty', notes: '' }])
  assert.deepEqual(groups.map((group) => group.key), ['citrus', 'musk', 'vanilla', 'white tea'])
  assert.deepEqual(groups[0].products.map((product) => product.id), ['one', 'two'])
  assert.deepEqual(groups[1].products.map((product) => product.id), ['one'])
  assert.deepEqual(groupProductsByNote(null), [])
})

test('legacy text banners remain readable with fixed titles and optional video content', () => {
  const stories = normalizeBannerStories(defaultBannerStories.map((story) => ({ ...story, title: 'changed', message: 'Existing content' })))
  assert.equal(stories.length, 5)
  assert.equal(stories[4].title, 'Why Severino?')
  assert.equal(stories[0].message, 'Existing content')
  assert.equal(stories[4].videoUrl, '')
  const video = normalizeBannerStories(stories.map((story, index) => ({ ...story, videoUrl: index === 4 ? driveUrl : '' })))
  assert.equal(video[4].videoUrl, driveUrl)
})

test('banner API validation accepts legacy messages and rejects unsupported video links', () => {
  assert.equal(bannerStoriesSchema.safeParse({ stories: defaultBannerStories }).success, true)
  const stories = normalizeBannerStories()
  stories[4].videoUrl = driveUrl
  assert.equal(bannerStoriesSchema.safeParse({ stories }).success, true)
  assert.equal(bannerStoriesSchema.safeParse({ stories: stories.slice(0, 4) }).success, false)
  stories[4].videoUrl = 'javascript:alert(1)'
  assert.equal(bannerStoriesSchema.safeParse({ stories }).success, false)
  stories[4].videoUrl = ''
  stories[0].videoUrl = driveUrl
  assert.equal(bannerStoriesSchema.safeParse({ stories }).success, false)
})
