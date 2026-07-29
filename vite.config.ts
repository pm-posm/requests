import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import fs from 'fs'
import { liveSearchPlugin } from './src/server/liveSearchPlugin'

// Plugin tự động nhân bản index.html sang 404.html
const copy404Plugin = () => ({
  name: 'copy-404',
  closeBundle() {
    const distPath = path.resolve(__dirname, 'dist')
    const indexPath = path.resolve(distPath, 'index.html')
    const fourOhFourPath = path.resolve(distPath, '404.html')
    if (fs.existsSync(indexPath)) {
      fs.copyFileSync(indexPath, fourOhFourPath)
    }
  }
})

// https://vite.dev/config/
export default defineConfig({
  base: '/',
  plugins: [react(), tailwindcss(), liveSearchPlugin(), copy404Plugin()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    chunkSizeWarningLimit: 2000,
  }
})
