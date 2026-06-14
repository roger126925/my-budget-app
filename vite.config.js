import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: '記帳本',
        short_name: '記帳本',
        description: '個人記帳 App',
        theme_color: '#534AB7',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: '/',
        icons: [
          {
            src: '/icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
        ],
        shortcuts: [
          {
            name: '記一筆',
            short_name: '記帳',
            description: '快速開啟記帳表單',
            url: '/?page=main',
            icons: [{ src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' }],
          },
          {
            name: '刷卡記帳',
            short_name: '刷卡',
            description: '快速開啟信用卡記帳',
            url: '/?page=credit',
            icons: [{ src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' }],
          },
        ],
      },
    }),
  ],
})
