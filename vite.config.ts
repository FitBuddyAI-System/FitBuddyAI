import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      // Only proxy backend admin API routes (e.g. /admin/audit)
      '/admin/audit': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/admin/': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        // don't rewrite root /admin (allow SPA to load at /admin)
        rewrite: (path) => path,
      }
    },
  },
})
