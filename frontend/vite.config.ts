import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  const backendProxy = {
    target: env.VITE_API_BASE_URL || 'http://127.0.0.1:8000',
    changeOrigin: true,
  }
  return {
    plugins: [
      react(),
      tailwindcss(),
    ],
    server: {
      proxy: {
        '/api': backendProxy,
        '/storage': backendProxy,
      },
    },
  }
})
