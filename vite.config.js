import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// En build (GitHub Pages) la app se sirve bajo /padel-planilla/; en dev, en la raíz.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/padel-planilla/' : '/',
  plugins: [react()],
}))
