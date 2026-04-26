import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'

// API target: backend RIHLA FastAPI on port 8000
const API_TARGET = process.env.VITE_API_URL
  || (process.env.DOCKER ? 'http://backend:8000' : 'http://127.0.0.1:8000')

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['manifest.json', 'pwa-192x192.png', 'pwa-512x512.png'],
      manifest: false, // already handled by public/manifest.json
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        // App shell — cache-first
        runtimeCaching: [
          {
            // API GET requests — network-first, fall back to cache (24h)
            urlPattern: ({ url }) => url.pathname.startsWith('/api/') && !url.pathname.includes('/generate'),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              networkTimeoutSeconds: 5,
              expiration: { maxEntries: 100, maxAgeSeconds: 24 * 60 * 60 },
              cacheableResponse: { statuses: [0, 200] },
              matchOptions: { ignoreSearch: false },
            },
          },
          {
            // AI generate & heavy POST endpoints — network-only (never cache)
            urlPattern: ({ url, request }) =>
              url.pathname.includes('/generate') || request.method !== 'GET',
            handler: 'NetworkOnly',
          },
          {
            // Google Fonts / external CDN
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts',
              expiration: { maxEntries: 10, maxAgeSeconds: 365 * 24 * 60 * 60 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      devOptions: {
        enabled: false, // disable SW in dev to avoid confusion
      },
    }),
  ],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': { target: API_TARGET, changeOrigin: true },
      '/socket.io': { target: API_TARGET, changeOrigin: true, ws: true },
    },
    watch: {
      usePolling: true,
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    target: 'es2020',
    // ── Performance: chunk splitting strategy ──────────────────────
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Vendor splitting — keep large deps in separate cached chunks
          if (id.includes('node_modules')) {
            if (id.includes('react-dom'))       return 'vendor-react'
            if (id.includes('react-router'))    return 'vendor-router'
            if (id.includes('@tanstack'))        return 'vendor-query'
            if (id.includes('lucide-react'))     return 'vendor-icons'
            if (id.includes('axios'))            return 'vendor-http'
            if (id.includes('date-fns'))         return 'vendor-date'
            if (id.includes('zod'))              return 'vendor-validation'
            if (id.includes('react-hook-form'))  return 'vendor-forms'
            if (id.includes('react-markdown'))   return 'vendor-markdown'
            if (id.includes('socket.io'))        return 'vendor-socket'
            if (id.includes('qrcode'))           return 'vendor-qrcode'
            if (id.includes('@dnd-kit'))         return 'vendor-dnd'
            return 'vendor'  // everything else from node_modules
          }
        },
      },
    },
    // Minification & optimization
    minify: 'esbuild',
    cssMinify: true,
  },
})
