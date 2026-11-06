import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { publicAssetsPlugin } from './build/publicAssets.js'
import { SHOW_HOME_SCROLL_VIDEO } from './src/config/storefrontFeatures.js'

export default defineConfig({
  plugins: [react(), publicAssetsPlugin({ includeScrollVideo: SHOW_HOME_SCROLL_VIDEO })],
  build: {
    // Copy active public assets through the plugin; leave disabled frame sequences out.
    copyPublicDir: false,
  },
  optimizeDeps: {
    exclude: ['server'],
  },
})
