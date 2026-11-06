import { existsSync } from 'node:fs'
import { cp, readdir } from 'node:fs/promises'
import { resolve } from 'node:path'

const scrollVideoFolders = new Set(['desktop_homevideo', 'mobile_homevideo'])

export function publicAssetsPlugin({ includeScrollVideo = false } = {}) {
  let publicDirectory
  let outputDirectory

  return {
    name: 'severino-public-assets',
    apply: 'build',
    configResolved(config) {
      publicDirectory = config.publicDir
      outputDirectory = resolve(config.root, config.build.outDir)
    },
    async writeBundle() {
      if (!publicDirectory || !existsSync(publicDirectory)) return
      const entries = await readdir(publicDirectory, { withFileTypes: true })
      await Promise.all(entries
        .filter((entry) => includeScrollVideo || !scrollVideoFolders.has(entry.name))
        .map((entry) => cp(resolve(publicDirectory, entry.name), resolve(outputDirectory, entry.name), { recursive: true })))
    },
  }
}
