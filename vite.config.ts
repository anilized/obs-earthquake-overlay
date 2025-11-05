import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const base = '/';

export default defineConfig({
  plugins: [react()],
  base,
  build: {
    outDir: path.resolve(__dirname, 'backend/src/main/resources/static'),
    emptyOutDir: true,
    assetsDir: 'assets',
  },
});
