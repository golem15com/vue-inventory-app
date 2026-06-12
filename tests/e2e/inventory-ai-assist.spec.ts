import { test, expect, request as playwrightRequest } from '@playwright/test'

/**
 * Phase 7 Plan 04 (/ai-assist) — the photo-to-catalog flow SHELL E2E.
 *
 * Proves the deterministic, backend-light surface of the flow — NOT model
 * accuracy. The live recognition response needs a configured Golem vision model,
 * so the happy path here STUBS POST /items/recognize via route interception (an
 * empty result → the "No items recognized" recovery → manual entry). This keeps
 * the suite green in CI without a model (mirrors the AI-SPEC `@group ai-live`
 * posture: the live recognize assertions stay out of CI).
 *
 * What it asserts:
 *   - Dashboard "Use AI to catalog" button → navigates to /ai-assist.
 *   - /ai-assist renders the heading + Step 1 (Area + Location pickers).
 *   - "Analyze photo" is DISABLED until Area + Location + a photo are all set.
 *   - Empty/manual path (stubbed recognize → empty): "Add manually" reveals an
 *     editable row; "Save all" is disabled with zero valid rows and enabled once
 *     a row has a name + a category.
 *
 * Discipline (carried from @inventory / @search specs): networkidle-gate every
 * goto before interacting (pre-hydration clicks are no-ops); scope role=option
 * selection to the open listbox (the header language <select> also renders
 * role=option). Lives in tests/e2e/ so the chromium project + auth.setup.ts login
 * chain pick it up. Backend-gated: skips (not fails) when the API is unreachable.
 *
 * Stable selectors this plan ships:
 *   - data-testid="analyze-photo"  → Step 2 Analyze button (gated)
 *   - data-testid="add-manually"   → empty/error recovery "Add manually"
 *   - data-testid="add-item"       → Review "Add item" row
 *   - data-testid="save-all"       → Step 4 "Save all ({n})"
 *   - data-testid="scan-more"      → Review-step "Scan more" (reset, keep Area)
 *   - data-testid="scan-more-saved"→ Post-save success-panel "Scan more"
 *   - data-testid="go-to-location" → Post-save success-panel "Go to {location}"
 *   - data-testid="saved-panel"    → Post-save success panel container
 *   - data-testid="filter-area"    → AreaCombobox trigger (reused)
 *   - data-testid="location-combobox" → LocationCombobox trigger (reused)
 *   - data-testid="category-combobox" → CategoryCombobox trigger (reused)
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

// A 1×1 PNG so the file input accepts a real image without a fixture on disk.
const PNG_1PX = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
)

test.describe('Inventory AI assist @inventory @ai-assist', () => {
  test('dashboard entry button navigates to /ai-assist', async ({ page }) => {
    test.skip(!(await inventoryReachable()), `Inventory API unreachable at ${BACKEND_URL}/_inventory/api/v1 — backend-gated, skipped`)

    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // "Use AI to catalog" sits beside Quick-add Item; clicking it lands on /ai-assist.
    await page.getByRole('button', { name: /use ai to catalog/i }).click()
    await page.waitForURL(/\/ai-assist/, { timeout: 10_000 })

    // The page heading renders.
    await expect(page.getByRole('heading', { name: /catalog with ai/i })).toBeVisible()
  })

  test('Step 1 renders and "Analyze photo" is disabled until Area+Location+photo', async ({ page }) => {
    test.skip(!(await inventoryReachable()), `Inventory API unreachable at ${BACKEND_URL}/_inventory/api/v1 — backend-gated, skipped`)

    await page.goto('/ai-assist')
    await page.waitForLoadState('networkidle')

    // Step 1 pickers are present (Area + Location).
    await expect(page.getByTestId('filter-area')).toBeVisible()
    await expect(page.getByTestId('location-combobox')).toBeVisible()

    // Analyze is disabled before any precondition is met.
    const analyze = page.getByTestId('analyze-photo')
    await expect(analyze).toBeDisabled()

    // Pick the first Area (scope to the open listbox — the language <select> also
    // renders role=option).
    await page.getByTestId('filter-area').click()
    await page.getByRole('listbox').getByRole('option').first().click()
    await page.waitForLoadState('networkidle')

    // Pick the first Location in the chosen Area.
    await page.getByTestId('location-combobox').click()
    await page.getByRole('listbox').getByRole('option').first().click()

    // Still disabled — no photo yet.
    await expect(analyze).toBeDisabled()

    // Stage a photo via the create-mode file input.
    await page.locator('input[type="file"]').first().setInputFiles({
      name: 'shelf.png',
      mimeType: 'image/png',
      buffer: PNG_1PX,
    })

    // Now all three preconditions are met → enabled.
    await expect(analyze).toBeEnabled()
  })

  test('manual path: stubbed empty recognize → Add manually → Save-all enablement', async ({ page }) => {
    test.skip(!(await inventoryReachable()), `Inventory API unreachable at ${BACKEND_URL}/_inventory/api/v1 — backend-gated, skipped`)

    // Stub recognition so the flow does NOT need a live model: an empty result
    // drives the "No items recognized" recovery → manual entry.
    await page.route('**/_inventory/api/v1/items/recognize', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: [] }),
      })
    })

    await page.goto('/ai-assist')
    await page.waitForLoadState('networkidle')

    // Area + Location + photo, then Analyze.
    await page.getByTestId('filter-area').click()
    await page.getByRole('listbox').getByRole('option').first().click()
    await page.waitForLoadState('networkidle')

    await page.getByTestId('location-combobox').click()
    await page.getByRole('listbox').getByRole('option').first().click()

    await page.locator('input[type="file"]').first().setInputFiles({
      name: 'shelf.png',
      mimeType: 'image/png',
      buffer: PNG_1PX,
    })

    await page.getByTestId('analyze-photo').click()

    // Empty state → "Add manually" reveals one editable row, never a dead end.
    const addManually = page.getByTestId('add-manually')
    await expect(addManually).toBeVisible({ timeout: 10_000 })
    await addManually.click()

    // The review step exposes a "Scan more" reset (D-07) alongside Save all.
    await expect(page.getByTestId('scan-more')).toBeVisible()

    // Save all is disabled with zero valid rows (the new row has no name/category).
    const saveAll = page.getByTestId('save-all')
    await expect(saveAll).toBeVisible()
    await expect(saveAll).toBeDisabled()

    // Fill the row name + pick a category → Save all becomes enabled.
    await page.getByRole('textbox').filter({ hasNot: page.locator('[readonly]') }).last().fill('Spare HDMI cable')
    await page.getByTestId('category-combobox').click()
    await page.getByRole('listbox').getByRole('option').first().click()

    await expect(saveAll).toBeEnabled()
  })
})
