import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// En build (GitHub Pages) la app se sirve bajo /padel-planilla/; en dev, en la raíz.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/padel-planilla/' : '/',
  plugins: [
    react(),
    VitePWA({
      // Actualiza el service worker solo cuando hay una versión nueva.
      registerType: 'autoUpdate',
      // Permite probar la instalación también con `vite dev`.
      devOptions: { enabled: true },
      includeAssets: ['logo.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Carest Padel · Turnos y ventas',
        short_name: 'Carest Padel',
        description: 'Planilla de turnos, consumos y fiados del club.',
        lang: 'es',
        theme_color: '#0f172a',
        background_color: '#f8fafc',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'pwa-maskable-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // Precachea los assets del build (incluye los .png de los íconos).
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        // SPA: cualquier ruta cae en index.html.
        navigateFallback: 'index.html',
      },
    }),
  ],
}))
