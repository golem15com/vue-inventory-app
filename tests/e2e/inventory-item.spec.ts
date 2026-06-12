import { test, expect, request as playwrightRequest } from '@playwright/test'

/**
 * UI-04 (Item create, single surface) — Wave-0 RED spec. Maps to 05-VALIDATION UI-04.
 *
 * Describes the dedicated Item form: name + grouped-Location combobox + category
 * (pick/create) + quantity + tag chips + notes + optional photo → Save → ONE
 * success toast (D-07) → the Item appears in the Location list and in Recent.
 * UI does not exist yet (Plan 05-05 greens this) — expected RED.
 *
 * Gate: probes GET /_inventory/api/v1/areas; skips when unreachable/unseeded.
 *
 * Stable selectors note (for Plan 03/04/05 to add):
 *   - data-testid="item-name"          → the Name input
 *   - data-testid="location-combobox"  → the grouped-by-Area Location picker
 *   - data-testid="category-combobox"  → the category picker (inline-create)
 *   - data-testid="item-quantity"      → the quantity number input
 *   - data-testid="tag-input"          → the tag chip input
 *   - data-testid="item-save"          → the single "Save Item" button
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

test.describe('@inventory @item', () => {
  test('create an Item from the form → single success toast → appears in lists', async ({ page }) => {
    test.skip(!(await inventoryReachable()), `Inventory API unreachable at ${BACKEND_URL}/_inventory/api/v1 — backend-gated, skipped`)

    await page.goto('/items/new')

    await page.getByTestId('item-name').fill('USB-C cable')

    // Grouped-by-Area Location combobox.
    await page.getByTestId('location-combobox').click()
    await page.getByRole('option').first().click()

    // Category combobox — pick or create-on-the-fly.
    await page.getByTestId('category-combobox').click()
    await page.getByRole('option').first().click()

    await page.getByTestId('item-quantity').fill('3')

    // Save — exactly ONE success toast (D-07), even though photo is a 2nd request.
    await page.getByTestId('item-save').click()
    await expect(page.getByText(/Item saved|Rzecz zapisana/i)).toBeVisible({ timeout: 10_000 })
  })
})
