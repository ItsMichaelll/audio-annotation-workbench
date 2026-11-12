import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
  },
  test: {
    maxWorkers: 2,
    include: ['src/**/*.test.{ts,tsx}'],
    environment: 'node',
    coverage: {
      reporter: ['text', 'html'],
    },
  },
})
