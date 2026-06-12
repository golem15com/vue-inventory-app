import { test, expect, request as playwrightRequest } from '@playwright/test'

/**
 * UI-02 (Location CRUD) — Wave-0 RED spec. Maps to 05-VALIDATION UI-02.
 *
 * Describes drilling into an Area, adding a Location, the General Location having
 * NO delete affordance, and the reassign-to-General consequence on a regular
 * Location delete. UI does not exist yet (Plan 05-05 greens this) — expected RED.
 *
 * Gate: probes GET /_inventory/api/v1/areas; skips when unreachable/unseeded.
 *
 * Stable selectors note (for Plan 03/04/05 to add):
 *   - data-testid="add-location"     → the Area-drill "Add Location" trigger
 *   - data-testid="location-row"     → each Location row
 *   - data-testid="location-general" → the General (catch-all) Location row
 *   - data-testid="location-delete"  → the delete affordance (absent on General)
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

test.describe('@inventory @location', () => {
  test('add a Location; General has no delete; regular delete reassigns to General', async ({ page }) => {
    test.skip(!(await inventoryReachable()), `Inventory API unreachable at ${BACKEND_URL}/_inventory/api/v1 — backend-gated, skipped`)

    // Drill into the first Area from the dashboard.
    await page.goto('/')
    await page.getByTestId('area-card').first().click()

    // Add a Location via the modal.
    await page.getByTestId('add-location').click()
    await page.getByLabel(/name/i).fill('Warsztat')
    await page.getByRole('button', { name: /save|add/i }).click()

    const row = page.getByTestId('location-row').filter({ hasText: 'Warsztat' })
    await expect(row).toBeVisible({ timeout: 10_000 })

    // The General Location row exposes NO delete affordance (D-06 / is_general).
    const general = page.getByTestId('location-general')
    await expect(general.getByTestId('location-delete')).toHaveCount(0)

    // Deleting a regular Location surfaces the reassign-to-General consequence.
    await row.getByTestId('location-delete').click()
    await expect(page.getByText(/will move to General/i)).toBeVisible()
  })
})
