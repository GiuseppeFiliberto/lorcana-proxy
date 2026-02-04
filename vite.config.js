import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true
      }
    },
    cssCodeSplit: true,
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
          'html2canvas': ['html2canvas'],
          'jspdf': ['jspdf'],
          'toastify': ['react-toastify'],
          'bootstrap': ['bootstrap']
        }
      }
    },
    chunkSizeWarningLimit: 500,
    assetsInlineLimit: 4096
  },
  server: {
    headers: {
      'Cache-Control': 'max-age=0'
    }
  }
})
