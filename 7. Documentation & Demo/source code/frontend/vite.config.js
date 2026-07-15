import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// The React dev server runs on 5173 and proxies /api to the Flask
// backend on 5000, so the frontend can call relative URLs.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
})
