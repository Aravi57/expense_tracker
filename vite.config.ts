import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

// Served from https://aravi57.github.io/expense_tracker/
export default defineConfig({
  base: '/expense_tracker/',
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon-180x180.png'],
      manifest: {
        name: 'Expense Tracker',
        short_name: 'Expenses',
        description: 'Track spending, budgets and investments across all your devices',
        theme_color: '#4f46e5',
        background_color: '#0b1020',
        display: 'standalone',
        start_url: '/expense_tracker/',
        scope: '/expense_tracker/',
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        // Supabase data is always fetched live; only the app shell is cached
        navigateFallback: 'index.html',
      },
    }),
  ],
  build: {
    rollupOptions: {
      output: {
        // Long-lived vendor code gets its own cached files. Chart code is left to the
        // bundler, which keeps it with the lazily loaded screens that draw charts.
        manualChunks(id: string) {
          if (/node_modules[\\/]@supabase[\\/]/.test(id)) return 'supabase';
          if (/node_modules[\\/](react|react-dom|scheduler|react-router)[\\/]/.test(id)) return 'react';
        },
      },
    },
  },
});
