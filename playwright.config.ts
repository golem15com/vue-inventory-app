import { defineConfig, devices } from '@playwright/test'
import dotenv from 'dotenv'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Load tests/e2e/.env.local first (gitignored, real credentials), then fall back
// to tests/e2e/.env. Playwright does not auto-load env files; this wires it.
dotenv.config({ path: path.join(__dirname, 'tests/e2e/.env.local') })
dotenv.config({ path: path.join(__dirname, 'tests/e2e/.env') })

const FRONTEND_URL = process.env.E2E_FRONTEND_URL || 'http://localhost:3000'
// Derive the dev-server port from the URL so `pnpm dev` boots on the SAME port
// Playwright probes — robust when the default :3000 is already taken by another app.
const FRONTEND_PORT = new URL(FRONTEND_URL).port || '3000'

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: [['html', { open: 'never' }], ['list']],

  use: {
    baseURL: FRONTEND_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    // Authenticated storageState produced by the `setup` project. Backend-gated
    // specs that need a logged-in session consume this; smoke/i18n do not require it.
    storageState: 'tests/e2e/.auth/user.json',
  },

  projects: [
    {
      name: 'setup',
      testMatch: /.*\.setup\.ts/,
      use: { storageState: { cookies: [], origins: [] } },
    },
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      dependencies: ['setup'],
    },
  ],

  // Boots the Nuxt dev server for the suite (no watch-mode flag — Playwright owns
  // the lifecycle); reuses an already-running dev server locally.
  webServer: {
    command: `pnpm dev --port ${FRONTEND_PORT}`,
    url: FRONTEND_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
