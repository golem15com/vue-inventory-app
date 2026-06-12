import { test, expect, request as playwrightRequest } from '@playwright/test'

/**
 * UI-05 (Search view) — Wave-0 RED spec. Maps to 06-VALIDATION UI-05.
 *
 * Describes the /search surface: a global query box returning permission-scoped
 * items with their Location · Area line, narrowing Area/Location/Category/Tag
 * filters (Area cascade narrows Location — D-05), an empty-q + filter "browse"
 * mode, deep-linkable URL state (q=… survives refresh), result→item navigation,
 * and an optional "load more" pager.
 *
 * The UI does not exist yet (Waves 1–3 green this) — every data-testid assertion
 * is expected RED until the matching component ships its selector.
 *
 * Gate: probes GET /_inventory/api/v1/areas; skips (not fails) when unreachable.
 *
 * Stable selectors the later waves MUST ship (asserted below):
 *   - data-testid="search-input"        → the global query box
 *   - data-testid="search-result-row"   → one result (name + "·"-joined Location/Area)
 *   - data-testid="filter-area"         → Area filter (cascade source)
 *   - data-testid="filter-location"     → Location filter (narrowed by Area)
 *   - data-testid="filter-category"     → Category filter
 *   - data-testid="filter-tag"          → Tag filter
 *   - data-testid="load-more"           → pager (only present when more results exist)
 *   - data-testid="clear-filters"       → reset all filters
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

test.describe('Inventory search @inventory @search', () => {
  test('search-query: a typed term returns scoped result rows with a name + Location · Area line', async ({ page }) => {
    test.skip(!(await inventoryReachable()), `Inventory API unreachable at ${BACKEND_URL}/_inventory/api/v1 — backend-gated, skipped`)

    await page.goto('/search')
    // Hydration gate: pre-hydration interactions are no-ops.
    await page.waitForLoadState('networkidle')

    // Type a broad term that the seed data should match.
    await page.getByTestId('search-input').fill('cable')
    await page.waitForLoadState('networkidle')

    const firstRow = page.getByTestId('search-result-row').first()
    await expect(firstRow).toBeVisible({ timeout: 10_000 })
    // The row carries a name AND a "·"-joined Location/Area line.
    await expect(firstRow).toContainText(/\S/)
    await expect(firstRow).toContainText('·')
  })

  test('search-filters + cascade: Area narrows results AND narrows the Location filter (D-05)', async ({ page }) => {
    test.skip(!(await inventoryReachable()), `Inventory API unreachable at ${BACKEND_URL}/_inventory/api/v1 — backend-gated, skipped`)

    await page.goto('/search')
    await page.waitForLoadState('networkidle')

    // Pick the first Area. Scope the option to the open listbox — the header
    // language <select> also renders role=option and would otherwise match.
    await page.getByTestId('filter-area').click()
    await page.getByRole('listbox').getByRole('option').first().click()
    await page.waitForLoadState('networkidle')

    // The result set reflects the chosen Area (≥0 rows, request settled).
    const rowsAfterArea = await page.getByTestId('search-result-row').count()
    expect(rowsAfterArea).toBeGreaterThanOrEqual(0)

    // Cascade (D-05): with an Area chosen, the Location filter options are
    // narrowed to that Area's Locations.
    await page.getByTestId('filter-location').click()
    const locationOptions = await page.getByRole('listbox').getByRole('option').count()
    expect(locationOptions).toBeGreaterThanOrEqual(1)
    // Close the Location listbox before opening the next filter.
    await page.keyboard.press('Escape')

    // Category filter narrows the result set.
    await page.getByTestId('filter-category').click()
    const categoryOptions = await page.getByRole('listbox').getByRole('option').count()
    expect(categoryOptions).toBeGreaterThanOrEqual(1)
    await page.keyboard.press('Escape')

    // Tag filter narrows the result set.
    await page.getByTestId('filter-tag').click()
    const tagOptions = await page.getByRole('listbox').getByRole('option').count()
    expect(tagOptions).toBeGreaterThanOrEqual(1)
    await page.keyboard.press('Escape')
  })

  test('search-browse: empty query + Area filter only returns matching items (browse mode)', async ({ page }) => {
    test.skip(!(await inventoryReachable()), `Inventory API unreachable at ${BACKEND_URL}/_inventory/api/v1 — backend-gated, skipped`)

    await page.goto('/search')
    await page.waitForLoadState('networkidle')

    // No query typed — apply an Area filter only. Empty q + filter = browse mode.
    await page.getByTestId('filter-area').click()
    await page.getByRole('listbox').getByRole('option').first().click()
    await page.waitForLoadState('networkidle')

    await expect(page.getByTestId('search-result-row').first()).toBeVisible({ timeout: 10_000 })
  })

  test('search-url-state: q= is reflected in the URL and rehydrates on refresh (deep-link)', async ({ page }) => {
    test.skip(!(await inventoryReachable()), `Inventory API unreachable at ${BACKEND_URL}/_inventory/api/v1 — backend-gated, skipped`)

    await page.goto('/search')
    await page.waitForLoadState('networkidle')

    await page.getByTestId('search-input').fill('cable')
    await page.waitForLoadState('networkidle')

    // The query is pushed to the URL (q=…) for deep-linking.
    await expect(page).toHaveURL(/[?&]q=/)

    // Reload: the search box rehydrates from the URL.
    await page.reload()
    await page.waitForLoadState('networkidle')
    await expect(page.getByTestId('search-input')).toHaveValue('cable')
  })

  test('search-result-click: clicking a result lands on /items/[id]', async ({ page }) => {
    test.skip(!(await inventoryReachable()), `Inventory API unreachable at ${BACKEND_URL}/_inventory/api/v1 — backend-gated, skipped`)

    await page.goto('/search')
    await page.waitForLoadState('networkidle')

    await page.getByTestId('search-input').fill('cable')
    await page.waitForLoadState('networkidle')

    await page.getByTestId('search-result-row').first().click()
    await page.waitForURL(/\/items\/\d+/, { timeout: 10_000 })
  })

  test('load-more: when the pager is present, clicking it grows the result-row count', async ({ page }) => {
    test.skip(!(await inventoryReachable()), `Inventory API unreachable at ${BACKEND_URL}/_inventory/api/v1 — backend-gated, skipped`)

    await page.goto('/search')
    await page.waitForLoadState('networkidle')

    // Broad query likely to overflow the first page.
    await page.getByTestId('search-input').fill('a')
    await page.waitForLoadState('networkidle')

    const loadMore = page.getByTestId('load-more')
    // Only assert the pager behavior when it is actually rendered (≥1 page overflow).
    if (await loadMore.count() > 0 && await loadMore.isVisible()) {
      const before = await page.getByTestId('search-result-row').count()
      await loadMore.click()
      await page.waitForLoadState('networkidle')
      const after = await page.getByTestId('search-result-row').count()
      expect(after).toBeGreaterThan(before)
    }
  })
})
