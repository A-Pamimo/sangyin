import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base: './' keeps asset URLs relative so the static build works whether it's
// served from the domain root or a GitHub Pages sub-path.
export default defineConfig({
  base: './',
  plugins: [react()],
})
