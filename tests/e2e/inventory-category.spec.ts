import { test, expect, request as playwrightRequest } from '@playwright/test'

/**
 * UI-03 (Category create-only) — Wave-0 RED spec. Maps to 05-VALIDATION UI-03.
 *
 * Describes the Categories screen (read-only rows + Add Category, create-only,
 * no edit/delete per D-12) plus create-on-the-fly inside the Item-form combobox.
 * UI does not exist yet (Plan 05-05 greens this) — expected RED.
 *
 * Gate: probes GET /_inventory/api/v1/areas; skips when unreachable/unseeded.
 *
 * Stable selectors note (for Plan 03/04/05 to add):
 *   - data-testid="add-category"        → the Categories-screen "Add Category" trigger
 *   - data-testid="category-row"        → each read-only category row
 *   - data-testid="category-combobox"   → the Item-form category combobox
 *   - data-testid="combobox-create"     → the synthetic "Create '{name}'" option
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

test.describe('@inventory @category', () => {
  test('add a category (read-only list, create-only)', async ({ page }) => {
    test.skip(!(await inventoryReachable()), `Inventory API unreachable at ${BACKEND_URL}/_inventory/api/v1 — backend-gated, skipped`)

    await page.goto('/categories')

    await page.getByTestId('add-category').click()
    await page.getByLabel(/name/i).fill('Narzędzia')
    await page.getByRole('button', { name: /save|add|create/i }).click()

    const row = page.getByTestId('category-row').filter({ hasText: 'Narzędzia' })
    await expect(row).toBeVisible({ timeout: 10_000 })

    // Create-only: no edit/delete affordance on a category row (D-12).
    await expect(row.getByRole('button', { name: /edit|delete|usuń|edytuj/i })).toHaveCount(0)
  })
})
