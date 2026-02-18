import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@components': path.resolve(__dirname, './src/components'),
      '@utils': path.resolve(__dirname, './src/utils'),
      '@pages': path.resolve(__dirname, './src/pages'),
      '@stores': path.resolve(__dirname, './src/stores'),
      '@hooks': path.resolve(__dirname, './src/hooks'),
      '@assets': path.resolve(__dirname, './src/assets'),
    },
  },
  server: {
    port: 3005,
    host: true,
    proxy: {
      // All traffic routes through the Go gateway
      '/auth': {
        target: 'http://localhost:4006',
        changeOrigin: true,
        secure: false,
        cookieDomainRewrite: 'localhost',
        cookiePathRewrite: {
          '/auth/session/refresh': '/auth/session/refresh',
          '*': '/'
        },
        bypass(req) {
          // Don't proxy browser navigation requests (HTML page requests).
          // Let Vite serve them as SPA routes so React Router handles
          // pages like /auth/reset-password and /auth/verify-email.
          if (req.headers.accept?.includes('text/html')) {
            return '/index.html';
          }
        },
      },
      '/api': {
        target: 'http://localhost:4006',
        changeOrigin: true,
        secure: false,
        cookieDomainRewrite: 'localhost',
        cookiePathRewrite: '/',
      },
      '/app-api': {
        target: 'http://localhost:4006',
        changeOrigin: true,
        secure: false,
        cookieDomainRewrite: 'localhost',
        cookiePathRewrite: '/',
      },
      '/socket.io': {
        target: 'http://localhost:4006',
        changeOrigin: true,
        secure: false,
        ws: true,
      },
    },
  },
  preview: {
    port: 3005,
    host: true
  }
})
