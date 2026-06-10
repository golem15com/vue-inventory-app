import { test, expect } from '@playwright/test'

/**
 * VUE-02 — boot/build smoke. The always-green baseline (D-13): the starter ships
 * its own passing E2E. No auth, no backend — proves the Nuxt app boots, SSR-renders,
 * and the default layout mounts. Maps to 17-VALIDATION.md VUE-02 row.
 */
test('smoke: home route responds 200 and the layout renders', async ({ page }) => {
  const response = await page.goto('/')
  expect(response, 'navigation produced a response').not.toBeNull()
  expect(response!.status(), 'home route returns 200').toBe(200)

  // Default layout header (app/layouts/default.vue) — the Home nav link renders on
  // every route. Resilient role/text selector, not brittle CSS.
  await expect(page.getByRole('link', { name: /home|strona główna/i }).first()).toBeVisible()

  // The demo home page renders its welcome heading (app/pages/index.vue).
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
})
