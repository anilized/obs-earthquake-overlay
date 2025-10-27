import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/obs-earthquake-overlay/', // change to '/emsc-obs/' for GitHub Pages under a repo
})
