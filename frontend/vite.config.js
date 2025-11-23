import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0', // Ensures the server is accessible on the network
    proxy: {
      // Catch any request starting with /api
      '/api': {
        target: 'http://127.0.0.1:8000', // Forward to FastAPI backend
        changeOrigin: true,
        secure: false,
      }
    }
  }
})