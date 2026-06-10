import { test, expect } from '@playwright/test'

/**
 * VUE-04 (auth) — login smoke, BACKEND-GATED. Maps to 17-VALIDATION.md VUE-04 (auth) row.
 *
 * Gate: skips when E2E_EMAIL/E2E_PASSWORD are unset (no seeded backend) so CI without a
 * backend SKIPS rather than FAILS. Seed via tests/e2e/helpers/runTinker.ts.
 *
 * This spec runs unauthenticated (it IS the login flow), so it starts from a clean
 * storageState rather than the setup project's authenticated jar.
 */
test.use({ storageState: { cookies: [], origins: [] } })

test.describe('login (backend-gated)', () => {
  test.skip(
    !process.env.E2E_EMAIL || !process.env.E2E_PASSWORD,
    'no seed creds (E2E_EMAIL/E2E_PASSWORD) — backend-gated, skipped in CI',
  )

  test('a seeded user can authenticate and the token never leaks to markup', async ({ page }) => {
    const email = process.env.E2E_EMAIL!
    const password = process.env.E2E_PASSWORD!

    await page.goto('/login')

    // login.vue: <label for>+<Input id> for email/password, submit button "Sign in".
    await page.getByLabel(/email/i).fill(email)
    await page.getByLabel(/password/i).fill(password)
    await page.getByRole('button', { name: /sign in/i }).click()

    // Authenticated state: login.vue redirects away from /login on success.
    await expect(page).not.toHaveURL(/\/login/, { timeout: 10_000 })

    // T-17-05 / T-17-13 regression lock: the JWT must NOT appear in rendered markup.
    // The token lives only in the auth_token cookie, never in the DOM.
    const cookies = await page.context().cookies()
    const tokenCookie = cookies.find(c => c.name === 'auth_token')
    const markup = await page.content()
    if (tokenCookie?.value) {
      expect(markup, 'JWT must not be rendered into the page markup').not.toContain(tokenCookie.value)
    }
    // Defensive: no raw 3-segment JWT pattern in the markup either.
    expect(markup).not.toMatch(/eyJ[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]{6,}/)
  })
})
