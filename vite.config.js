import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/*.png', 'offline.html'],
      // We manage our own manifest.json in /public
      manifest: false,
      workbox: {
        // Pre-cache all built assets
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],

        // Offline fallback for navigation requests
        navigateFallback: null,
        offlineFallback: '/offline.html',

        runtimeCaching: [
          {
            // Google Fonts stylesheets — stale while revalidate
            urlPattern: /^https:\/\/fonts\.googleapis\.com/,
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'google-fonts-stylesheets' }
          },
          {
            // Google Fonts files — cache forever
            urlPattern: /^https:\/\/fonts\.gstatic\.com/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-webfonts',
              expiration: {
                maxEntries: 20,
                maxAgeSeconds: 60 * 60 * 24 * 365
              }
            }
          },
          {
            // Supabase REST — network first, fall back to cache
            urlPattern: /^https:\/\/.*\.supabase\.co\/rest/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-api',
              networkTimeoutSeconds: 5,
              expiration: { maxEntries: 50, maxAgeSeconds: 60 * 5 }
            }
          },
          {
            // Supabase Auth — always network (never serve stale tokens)
            urlPattern: /^https:\/\/.*\.supabase\.co\/auth/,
            handler: 'NetworkOnly'
          }
        ]
      }
    })
  ],
  server: { port: 3000 }
})
