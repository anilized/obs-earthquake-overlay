import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Serve app under /api path
const base = '/'

export default defineConfig({
  plugins: [react()],
  base,
})
