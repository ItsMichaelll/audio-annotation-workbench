import { defineConfig } from '@playwright/test'

const port = Number(process.env.AAW_PREVIEW_PORT ?? 4173)

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    headless: true,
    viewport: { width: 1440, height: 900 },
    launchOptions: {
      channel: 'chrome',
      args: ['--mute-audio', '--disable-gpu', '--disable-dev-shm-usage'],
    },
  },
  webServer: {
    command: `pnpm exec vite preview --host 127.0.0.1 --port ${port} --strictPort`,
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: false,
  },
})
