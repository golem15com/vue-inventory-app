import { test, expect, request as playwrightRequest } from '@playwright/test'

/**
 * Phase 12 Plan 07 (/organisation) — the org management / read-only page SHELL E2E.
 *
 * Proves the deterministic, role-branched surface of the page — NOT the live BYOK
 * AI flow (no live key in CI; that end-to-end path is human-verified per
 * VALIDATION.md, mirroring the Phase 7 @ai-assist discipline). The auth.setup.ts
 * login chain provides the default user; their `organisation_role` decides which
 * branch renders, so each assertion is conditional on what the seeded session is.
 *
 * What it asserts (DOM level, role-dependent):
 *   - The page renders the "Organisation" title + Breadcrumbs without crashing,
 *     for ANY org state (owner/admin, member, or no-org).
 *   - An owner/admin session sees the Shared AI provider card (org-ai-save) AND
 *     the "Add member" CTA.
 *   - A plain-member session sees the "Using shared organisation credentials" band
 *     (org-shared-band) and NO "Add member" CTA, and is NOT redirected away
 *     (the URL stays /organisation — D-13).
 *
 * Documented MANUAL verification (out of CI — no live BYOK key, no seeded AI
 * model): saving a real org AI key + confirming the success band + the member
 * using the shared key for photo-to-catalog (resolution precedence end-to-end).
 * See the Plan 07 human-verify checkpoint.
 *
 * Discipline (carried from @inventory / @ai-assist specs): networkidle-gate every
 * goto before interacting (pre-hydration clicks are no-ops). Backend-gated: skips
 * (not fails) when the Inventory API is unreachable.
 *
 * Stable selectors this plan ships:
 *   - data-testid="org-ai-save"        → owner/admin Shared AI "Save key" button
 *   - data-testid="add-member"         → owner/admin "Add member" CTA
 *   - data-testid="member-row"         → a member roster row
 *   - data-testid="member-remove"      → per-row destructive-confirm remove (icon)
 *   - data-testid="confirm-remove-member" → the destructive confirm button
 *   - data-testid="org-shared-band"    → plain-member read-only credentials band
 *   - data-testid="org-ai-locked-band" → org-lock enforced notice (owner/admin)
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

test.describe('Organisation page @inventory @organisation', () => {
  test('renders the role-branched page without crashing', async ({ page }) => {
    test.skip(!(await inventoryReachable()), `Inventory API unreachable at ${BACKEND_URL}/_inventory/api/v1 — backend-gated, skipped`)

    await page.goto('/organisation')
    await page.waitForLoadState('networkidle')

    // The title + breadcrumb render for every org state (owner/admin, member, no-org).
    await expect(page.getByRole('heading', { level: 1, name: /organisation|organizacja/i })).toBeVisible()
    // The member is NEVER redirected away (D-13) — the URL stays on /organisation.
    await expect(page).toHaveURL(/\/organisation/)
  })

  test('owner/admin sees Shared AI card + Add member; member sees the shared band, no add', async ({ page }) => {
    test.skip(!(await inventoryReachable()), `Inventory API unreachable at ${BACKEND_URL}/_inventory/api/v1 — backend-gated, skipped`)

    await page.goto('/organisation')
    await page.waitForLoadState('networkidle')

    const addMember = page.getByTestId('add-member')
    const sharedBand = page.getByTestId('org-shared-band')

    if (await addMember.count()) {
      // Owner/admin branch: the management surface is present.
      await expect(addMember.first()).toBeVisible()
      await expect(page.getByTestId('org-ai-save').first()).toBeVisible()
      // The read-only member band must NOT render for a manager.
      await expect(sharedBand).toHaveCount(0)
    }
    else if (await sharedBand.count()) {
      // Plain-member branch: the read-only band, and explicitly NO add/manage CTA.
      await expect(sharedBand.first()).toBeVisible()
      await expect(addMember).toHaveCount(0)
      await expect(page.getByTestId('org-ai-save')).toHaveCount(0)
    }
    else {
      // No-org branch: the page degrades to an EmptyState, never crashes.
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    }
  })
})
