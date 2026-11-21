import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// API server for local development (`npm run dev` in project/ starts it on 5000)
const apiTarget = process.env.API_PROXY_TARGET || 'http://localhost:5000'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000, // matches the server's default CLIENT_ORIGIN
    strictPort: true,
    // Relative /api and /proxy calls go to the Express server, so dev works like
    // the single-server Docker setup planned for the NAS
    proxy: {
      '/api': apiTarget,
      '/proxy': apiTarget,
    },
  },
  preview: {
    port: 3000,
  },
  build: {
    outDir: 'build', // Netlify publishes client/build
  },
})
