import { test, expect, request as playwrightRequest } from '@playwright/test'

/**
 * UI-07 (Responsive layout) — Wave-0 RED spec. Maps to 06-VALIDATION UI-07.
 *
 * Encodes the mobile-first breakpoint contract (06-UI-SPEC D-12):
 *   - Phone (~375–430px): single column; top bar = app name + search box +
 *     hamburger only; the inline filter bar collapses to a single "Filters"
 *     button that opens a bottom `sheet` (D-04); the hamburger opens a nav
 *     drawer (D-10).
 *   - Desktop (lg: ≥1024px): inline filter bar is visible WITHOUT a Filters
 *     button; the hamburger is hidden (inline nav instead).
 *
 * The responsive chrome does not exist yet (Wave 2 greens this) — every
 * data-testid assertion is expected RED until the components ship their
 * selectors.
 *
 * Gate: probes GET /_inventory/api/v1/areas; skips (not fails) when unreachable.
 *
 * Stable selectors the responsive chrome MUST ship (asserted below):
 *   - data-testid="nav-menu"        → the hamburger trigger (phone-only nav drawer)
 *   - data-testid="filters-button"  → the "Filters" button (phone-only → bottom sheet)
 *   - data-testid="filter-area"     → an Area filter control (inline on desktop / in sheet on phone)
 *   - data-testid="search-input"    → the top-bar query box (visible at every width)
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

test.describe('Responsive layout @inventory @responsive', () => {
  test('responsive-phone: hamburger nav drawer + Filters bottom sheet + single-column top bar', async ({ page }) => {
    test.skip(!(await inventoryReachable()), `Inventory API unreachable at ${BACKEND_URL}/_inventory/api/v1 — backend-gated, skipped`)

    // Phone viewport (~iPhone 13 logical size).
    await page.setViewportSize({ width: 390, height: 844 })

    await page.goto('/')
    // Hydration gate: pre-hydration clicks are no-ops.
    await page.waitForLoadState('networkidle')

    // The hamburger is visible on phone…
    await expect(page.getByTestId('nav-menu')).toBeVisible()
    // …and opens a nav drawer with the navigation links inside.
    await page.getByTestId('nav-menu').click()
    await expect(page.getByRole('link', { name: /categories|kategorie/i })).toBeVisible({ timeout: 5_000 })
    // Close the drawer before moving on.
    await page.keyboard.press('Escape')

    await page.goto('/search')
    await page.waitForLoadState('networkidle')

    // The top-bar search box stays visible on phone.
    await expect(page.getByTestId('search-input')).toBeVisible()

    // The inline filter bar collapses to a single "Filters" button…
    await expect(page.getByTestId('filters-button')).toBeVisible()
    // …which opens the bottom filter sheet exposing the Area filter inside.
    await page.getByTestId('filters-button').click()
    await expect(page.getByTestId('filter-area')).toBeVisible({ timeout: 5_000 })
  })

  test('responsive-desktop: inline filter bar visible, hamburger hidden', async ({ page }) => {
    test.skip(!(await inventoryReachable()), `Inventory API unreachable at ${BACKEND_URL}/_inventory/api/v1 — backend-gated, skipped`)

    // Desktop viewport (lg: ≥1024px).
    await page.setViewportSize({ width: 1280, height: 900 })

    await page.goto('/search')
    await page.waitForLoadState('networkidle')

    // The inline filter bar is rendered directly — no "Filters" button click needed.
    await expect(page.getByTestId('filter-area')).toBeVisible()

    // The hamburger is hidden on desktop (inline nav replaces it).
    await expect(page.getByTestId('nav-menu')).toBeHidden()
  })
})
