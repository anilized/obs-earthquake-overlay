import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Serve app under /api path
const base = '/api/'

export default defineConfig({
  plugins: [react()],
  base,
})
