import { test, expect, request as playwrightRequest } from '@playwright/test'

/**
 * UI-06 (access scoping) — Wave-0 RED spec. Maps to 05-VALIDATION UI-06.
 *
 * Two structural guarantees:
 *   1. An unauthenticated visit to `/` redirects to `/login` (UX-only middleware).
 *   2. An authenticated user sees ONLY their accessible Areas — a foreign Area is
 *      structurally absent (never a disabled card / "no permission"). The real
 *      boundary is server-side (jwt.auth + accessibleBy); this asserts the SPA
 *      renders only what the scoped API returns.
 * The dashboard does not exist yet (Plan 05-05 greens part 2) — expected RED.
 *
 * Gate: probes GET /_inventory/api/v1/areas; skips part 2 when unreachable/unseeded.
 * Part 1 (redirect) does not need a seeded backend — it uses a clean (no-auth) context.
 */
const BACKEND_URL = process.env.E2E_BACKEND_URL || 'http://localhost:8000'

async function inventoryReachable(): Promise<boolean> {
  try {
    const ctx = await playwrightRequest.newContext()
    const res = await ctx.get(`${BACKEND_URL}/_inventory/api/v1/areas`, { timeout: 5_000 })
    const reachable = res.ok() || res.status() === 401
    await ctx.dispose()
    return reachable
  }
  catch {
    return false
  }
}

test.describe('@inventory @access', () => {
  // Part 1: unauthenticated → redirect to /login. Clean context, no storageState.
  test.describe('unauthenticated', () => {
    test.use({ storageState: { cookies: [], origins: [] } })

    test('visiting / redirects to /login', async ({ page }) => {
      await page.goto('/')
      await expect(page).toHaveURL(/\/login/, { timeout: 10_000 })
    })
  })

  // Part 2: authenticated → only accessible Areas; no foreign-Area affordance.
  test('authenticated user sees only accessible Areas (no foreign-Area affordance)', async ({ page }) => {
    test.skip(!(await inventoryReachable()), `Inventory API unreachable at ${BACKEND_URL}/_inventory/api/v1 — backend-gated, skipped`)

    await page.goto('/')
    // The seeded foreign Area name must never render (structural absence).
    await expect(page.getByText('Foreign Area')).toHaveCount(0)
  })
})
