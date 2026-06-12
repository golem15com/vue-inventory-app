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

    const itemName = `USB-C cable ${Date.now()}`

    await page.goto('/items/new')
    // Wait for hydration so the comboboxes (Popover + Command) are interactive and
    // the store has loaded the grouped Locations / Categories the options render from.
    await page.waitForLoadState('networkidle')

    await page.getByTestId('item-name').fill(itemName)

    // Grouped-by-Area Location combobox (Popover + Command; items are role=option).
    // Scope to the open listbox — the header language <select> also renders
    // role=option elements, so an unscoped getByRole('option') would match those.
    await page.getByTestId('location-combobox').click()
    await page.getByRole('listbox').getByRole('option').first().click()

    // Category combobox — pick the first existing option (seed provides a category).
    await page.getByTestId('category-combobox').click()
    await page.getByRole('listbox').getByRole('option').first().click()

    await page.getByTestId('item-quantity').fill('3')

    // Add a tag chip (add-on-Enter).
    await page.getByTestId('tag-input').getByRole('textbox').fill('cable')
    await page.getByTestId('tag-input').getByRole('textbox').press('Enter')

    // Save — exactly ONE success toast (D-07), even though photo is a 2nd request.
    await page.getByTestId('item-save').click()
    await expect(page.getByText(/Item saved|Rzecz zapisana/i)).toBeVisible({ timeout: 10_000 })

    // After save it navigates to the Location list, where the new Item appears.
    await expect(page.getByTestId('item-row').filter({ hasText: itemName }))
      .toBeVisible({ timeout: 10_000 })
  })
})
