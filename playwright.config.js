import { defineConfig } from '@playwright/test'

if (!process.env.E2E_FIXTURE_MANIFEST || !process.env.E2E_BASE_URL) throw new Error('Usa pnpm test:e2e para iniciar el fixture local; no se admiten APIs externas.')
const baseURL = new URL(process.env.E2E_BASE_URL)
if (baseURL.protocol !== 'http:' || baseURL.hostname !== '127.0.0.1' || !baseURL.port) throw new Error('La interfaz de pruebas debe ejecutarse en loopback con puerto aleatorio.')

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: true,
  timeout: 90000,
  expect: { timeout: 15000 },
  reporter: [['list']],
  outputDir: 'test-results',
  use: {
    baseURL: baseURL.origin,
    headless: true,
    channel: process.env.E2E_BROWSER_EXECUTABLE ? undefined : 'chrome',
    launchOptions: process.env.E2E_BROWSER_EXECUTABLE ? { executablePath: process.env.E2E_BROWSER_EXECUTABLE } : {},
    screenshot: 'off',
    trace: 'off',
    video: 'off',
  },
})
