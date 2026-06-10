import { test, expect, request as playwrightRequest } from '@playwright/test'

/**
 * VUE-04 (blog) — blog index smoke, BACKEND-GATED. Maps to 17-VALIDATION.md VUE-04 (blog) row.
 *
 * Gate: probes the Journal API (GET /_journal/api/v1/posts) at the backend; skips when it
 * is unreachable or returns no published posts, so CI without a seeded backend SKIPS rather
 * than FAILS. Seed >= 1 published post via tests/e2e/helpers/runTinker.ts.
 */
const BACKEND_URL = process.env.E2E_BACKEND_URL || 'http://localhost:8000'

test.describe('blog index (backend-gated)', () => {
  test('blog index SSR-renders >= 1 published post', async ({ page }) => {
    // Reachability + content gate: try the Journal posts endpoint directly.
    let postCount = 0
    let reachable = false
    try {
      const ctx = await playwrightRequest.newContext()
      const res = await ctx.get(`${BACKEND_URL}/_journal/api/v1/posts`, { timeout: 5_000 })
      reachable = res.ok()
      if (reachable) {
        const body = await res.json().catch(() => null)
        postCount = Array.isArray(body?.data) ? body.data.length : 0
      }
      await ctx.dispose()
    }
    catch {
      reachable = false
    }

    test.skip(!reachable, `Journal API unreachable at ${BACKEND_URL} — backend-gated, skipped`)
    test.skip(reachable && postCount < 1, 'no published journal posts seeded — seed via runTinker.ts')

    await page.goto('/blog')

    // blog/index.vue renders posts as <li> items (each with an <h2> title) in a grid <ul>.
    // Resilient: count the post list items rather than brittle CSS classes.
    const items = page.locator('ul li')
    await expect(items.first()).toBeVisible({ timeout: 10_000 })
    expect(await items.count(), 'at least one post item renders').toBeGreaterThanOrEqual(1)
  })
})
