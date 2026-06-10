import { test, expect } from '@playwright/test'

/**
 * VUE-03 — realtime smoke, CENTRIFUGO-GATED. Maps to 17-VALIDATION.md VUE-03 row.
 *
 * Two paths (A3 — gate on availability):
 *  - Centrifugo available (E2E_CENTRIFUGO=1 + a logged-in storageState + the
 *    starter's centrifugoWsUrl set): assert the connection status badge reaches
 *    "Connected". This requires a live backend (mints /api/realtime/token) and a
 *    running Centrifugo, so it is OPT-IN via E2E_CENTRIFUGO to stay CI-safe.
 *  - Centrifugo absent (the default starter posture, centrifugoWsUrl empty): the
 *    composable degrades gracefully (warn + no-op) and the page surfaces a
 *    "realtime not configured" note. Assert that note renders AND the page did
 *    not crash (status badge still present, heading still renders).
 *
 * No watch-mode flag — Playwright owns the dev-server lifecycle.
 */
const CENTRIFUGO_AVAILABLE = process.env.E2E_CENTRIFUGO === '1'

test.describe('realtime demo (Centrifugo-gated)', () => {
  test('home wires realtime: connected when Centrifugo up, else graceful-degrade', async ({ page }) => {
    const response = await page.goto('/')
    expect(response, 'navigation produced a response').not.toBeNull()
    expect(response!.status(), 'home route returns 200').toBe(200)

    // The page must always boot — heading + status badge render regardless of WS.
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    const statusBadge = page.getByTestId('realtime-status')
    await expect(statusBadge).toBeVisible()

    if (CENTRIFUGO_AVAILABLE) {
      // Live path: requires a seeded auth session + running Centrifugo + WS URL.
      // The badge should flip to "Connected" once the client handshakes.
      await expect(statusBadge).toHaveText(/connected|połączono/i, { timeout: 15_000 })
    }
    else {
      // Graceful-degrade path (default): the honest "not configured" note renders
      // and the app did NOT crash. This is the always-green VUE-03 baseline.
      await expect(page.getByTestId('realtime-degraded')).toBeVisible()
      // Badge stays in the disconnected state (never connected without WS).
      await expect(statusBadge).toHaveText(/disconnected|rozłączono/i)
    }
  })
})
