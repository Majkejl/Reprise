import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: process.env.VITE_BASE_PATH ?? '/',
  plugins: [
    react(),
    VitePWA({
      // New SW version takes control immediately; user gets fresh app on next navigation.
      registerType: 'autoUpdate',
      manifest: {
        name: 'Reprise',
        short_name: 'Reprise',
        description: 'Spaced repetition study app',
        theme_color: '#09090b',
        background_color: '#09090b',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        icons: [
          {
            // DECISION: SVG placeholder — replace with PNG (192×192, 512×512) before public launch
            // (Phase 8). Chrome requires PNG icons for the "Add to Home Screen" prompt.
            src: 'icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any',
          },
        ],
      },
      workbox: {
        // Serve cached index.html for all navigation requests (SPA with HashRouter).
        navigateFallback: 'index.html',
        // Precache all build artifacts: HTML, JS, CSS, and static assets.
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            // index.json — network-first per D2: drives update detection; cache fallback when offline.
            urlPattern: /\/index\.json(\?.*)?$/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'lesson-indexes',
              networkTimeoutSeconds: 10,
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Lesson JSON — cache-first per D2: stable between syncs; updated during explicit sync.
            // Note: the index.json rule above takes precedence for that URL pattern.
            urlPattern: /\.json(\?.*)?$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'lesson-content',
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
