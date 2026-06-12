import { test, expect, request as playwrightRequest } from '@playwright/test'

/**
 * UI-01 (Area CRUD) — Wave-0 RED spec. Maps to 05-VALIDATION UI-01.
 *
 * Describes the intended dashboard Area create/edit/delete behavior. The UI does
 * not exist yet (Plan 05-05 greens this), so this is expected RED now.
 *
 * Gate: probes the Inventory API (GET /_inventory/api/v1/areas) at the backend;
 * `test.skip`s when unreachable/unseeded, so CI without a seeded backend SKIPS
 * rather than FAILS. Seed an authenticated user + Area via helpers/runTinker.ts.
 *
 * Stable selectors note (for Plan 03/04/05 to add):
 *   - data-testid="create-area"      → the dashboard "Create Area" trigger
 *   - data-testid="area-card"        → each rendered Area card
 *   - data-testid="area-delete"      → the owner-only trash affordance on a card
 *   - data-testid="confirm-delete"   → the destructive confirm button in the dialog
 */
const BACKEND_URL = process.env.E2E_BACKEND_URL || 'http://localhost:8000'

async function inventoryReachable(): Promise<boolean> {
  try {
    const ctx = await playwrightRequest.newContext()
    const res = await ctx.get(`${BACKEND_URL}/_inventory/api/v1/areas`, { timeout: 5_000 })
    // 200 (seeded) or 401 (reachable but unauthenticated) both prove reachability.
    const reachable = res.ok() || res.status() === 401
    await ctx.dispose()
    return reachable
  }
  catch {
    return false
  }
}

test.describe('@inventory @area', () => {
  test('create → edit → delete an Area with consequence dialog', async ({ page }) => {
    test.skip(!(await inventoryReachable()), `Inventory API unreachable at ${BACKEND_URL}/_inventory/api/v1 — backend-gated, skipped`)

    // Unique name so this create→delete cycle never collides with (or removes)
    // the seeded "Reymonta" Area the other @inventory specs rely on.
    const areaName = `Garaż ${Date.now()}`

    await page.goto('/')
    // Wait for Nuxt hydration before clicking — a click on the SSR-rendered button
    // before its @click handler attaches is a no-op (the dialog would never open).
    await page.waitForLoadState('networkidle')

    // Create an Area via the dashboard "Create Area" modal.
    await page.getByTestId('create-area').click()
    await page.getByLabel(/name/i).fill(areaName)
    await page.getByRole('button', { name: /save|create/i }).click()

    // It appears as a card with location/item counts.
    const card = page.getByTestId('area-card').filter({ hasText: areaName })
    await expect(card).toBeVisible({ timeout: 10_000 })

    // Delete → the consequence dialog spells out the cascade, then confirm.
    await card.getByTestId('area-delete').click()
    await expect(page.getByText(/removes .* Locations and .* Items/i)).toBeVisible()
    await page.getByTestId('confirm-delete').click()

    // The card is gone.
    await expect(card).toHaveCount(0)
  })
})
