import viteCompression from 'vite-plugin-compression'
import { createHtmlPlugin } from 'vite-plugin-html'
import glsl from 'vite-plugin-glsl'
import { VitePWA } from 'vite-plugin-pwa'
import react from '@vitejs/plugin-react'

const vitePlugins: any = (env: any) => {
  return [
    react(), // React plugin
    glsl(), // Convenient for you to write shader
    viteCompression({
      verbose: true, // Whether to output compression results on the console
      disable: false, // Do not disable compression
      deleteOriginFile: false, // Whether to delete the original file after compression
      threshold: 10240, // Whether to delete the original file after compression
      ext: '.gz', // file type
      algorithm: 'gzip' // Compression algorithm
    }),
    createHtmlPlugin({
      inject: {
        data: {
          title: env.VITE_APP_TITLE // Need to reference environment variables in html
        }
      }
    }),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      devOptions: {
        enabled: true,
      },
      workbox: {
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024, // 6MB
      },
    }),
  ]
}

export { vitePlugins }