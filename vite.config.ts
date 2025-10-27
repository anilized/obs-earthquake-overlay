import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// If deploying to https://<user>.github.io/<repo>/ set base: '/<repo>/'
export default defineConfig({
  plugins: [react()],
  base: '', // change to '/emsc-obs/' for GitHub Pages under a repo
})
