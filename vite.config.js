import { fileURLToPath, URL } from 'url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { visualizer } from "rollup-plugin-visualizer";


// https://vitejs.dev/config/
export default defineConfig({
  plugins: [vue(), visualizer({
  //  template: 'network'
  })],
  base: '',
  server: {
    port: 8080
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  publicDir: 'public',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/@lottiefiles/dotlottie-web')) {
            return 'dotlottie';
          }
          // You could add more rules here for other large dependencies if needed
          // e.g., for w-gl or vue core, though often kept in the main chunk
          // if (id.includes('node_modules/w-gl')) {
          //   return 'w-gl';
          // }
        }
      }
    }
  }
})
