import { resolve } from 'path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  main: {
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'electron/main/index.js')
        },
        external: ['@electron-toolkit/utils', 'electron-store', 'ali-oss', '@aws-sdk/client-s3', '@aws-sdk/lib-storage', '@aws-sdk/s3-request-presigner']
      }
    }
  },
  preload: {
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'electron/preload/index.mjs')
        },
        external: ['@electron-toolkit/preload']
      }
    }
  },
  renderer: {
    root: '.',
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'index.html')
        }
      },
      assetsDir: 'assets',
      assetsInlineLimit: 0,
      sourcemap: true
    },
    resolve: {
      alias: {
        '@': resolve('src/')
      }
    },
    plugins: [react()]
  }
}) 