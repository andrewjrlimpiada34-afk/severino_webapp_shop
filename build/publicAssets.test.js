import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, dirname, join, resolve } from 'node:path'
import { publicAssetsPlugin } from './publicAssets.js'

for (const includeScrollVideo of [false, true]) {
  test(`public assets preserve active media with scroll video ${includeScrollVideo ? 'enabled' : 'disabled'}`, async () => {
    const root = await mkdtemp(join(tmpdir(), 'severino-public-assets-'))
    const publicDir = join(root, 'public')
    const outDir = 'dist'
    try {
      for (const file of ['logo.svg', 'images/editorial.webp', 'fonts/body.woff2', 'hero/default.svg', 'desktop_homevideo/default/frame.jpg', 'mobile_homevideo/default/frame.jpg']) {
        const segments = file.split('/')
        await mkdir(join(publicDir, ...segments.slice(0, -1)), { recursive: true })
        await writeFile(join(publicDir, ...segments), file)
      }
      const plugin = publicAssetsPlugin({ includeScrollVideo })
      plugin.configResolved({ publicDir, root, build: { outDir } })
      await plugin.writeBundle()
      for (const file of ['logo.svg', 'images/editorial.webp', 'fonts/body.woff2', 'hero/default.svg']) {
        assert.equal(await readFile(join(root, outDir, file), 'utf8'), file)
      }
      for (const folder of ['desktop_homevideo', 'mobile_homevideo']) {
        assert.equal(existsSync(join(root, outDir, folder)), includeScrollVideo)
        assert.ok(existsSync(join(publicDir, folder)), 'Original media stays available locally')
      }
    } finally {
      // This is the uniquely created test directory; source assets are never removed.
      assert.equal(dirname(resolve(root)), resolve(tmpdir()))
      assert.ok(basename(root).startsWith('severino-public-assets-'))
      await rm(root, { recursive: true, force: true })
    }
  })
}

test('projects without a public directory can still build', async () => {
  const plugin = publicAssetsPlugin()
  plugin.configResolved({ publicDir: false, root: process.cwd(), build: { outDir: 'dist' } })
  await plugin.writeBundle()
})
