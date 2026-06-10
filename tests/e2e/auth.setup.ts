import { test as setup, expect } from '@playwright/test'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const authFile = path.join(__dirname, '.auth/user.json')

/**
 * storageState login (model: horoskopia tests/e2e/auth.setup.ts).
 *
 * Logs the seeded E2E_* user in against the starter's /login page (17-02) and
 * persists the authenticated cookie jar to tests/e2e/.auth/user.json, which the
 * `chromium` project loads via `storageState` (playwright.config.ts).
 *
 * BACKEND-GATED: this needs a running WinterCMS backend (localhost:8000) with a
 * seeded user (see tests/e2e/helpers/runTinker.ts). When E2E_EMAIL/E2E_PASSWORD
 * are unset it writes an EMPTY storageState and returns — CI without a seed SKIPS
 * the real login yet the dependent chromium project still runs (the global
 * `use.storageState` file always exists). This is the CI-safe graceful path (T-17-12).
 *
 * SECURITY: credentials come from the env only (never committed — see
 * tests/e2e/.env.example placeholders). The token is never logged.
 */
setup('authenticate', async ({ page, context }) => {
  const email = process.env.E2E_EMAIL
  const password = process.env.E2E_PASSWORD

  // No seed creds (CI without a backend): write an empty jar so the file the global
  // `use.storageState` points at always exists, then bail. Dependent specs that
  // genuinely need auth are themselves backend-gated (test.skip).
  if (!email || !password) {
    console.warn(
      '[auth.setup] E2E_EMAIL / E2E_PASSWORD unset — writing empty storageState '
      + '(copy tests/e2e/.env.example to .env.local + seed a user via helpers/runTinker.ts to enable login).',
    )
    await context.storageState({ path: authFile })
    return
  }

  await page.goto('/login')
  await page.waitForLoadState('networkidle')

  // /login uses <label for>+<Input id> (login.vue) — getByLabel matches the label text.
  await page.getByLabel(/email/i).fill(email!)
  await page.getByLabel(/password/i).fill(password!)
  // Submit button text is "Sign in" (login.vue).
  await page.getByRole('button', { name: /sign in/i }).click()

  // On success the page redirects away from /login (login.vue navigateTo(redirect)).
  await expect(page).not.toHaveURL(/\/login/, { timeout: 10_000 })

  await context.storageState({ path: authFile })
})
