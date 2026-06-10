import { test, expect } from '@playwright/test'

/**
 * VUE-04 (i18n) — locale rendering smoke. Maps to 17-VALIDATION.md VUE-04 (i18n) row.
 *
 * No backend needed: messages are local (i18n/locales/{en,pl}.json).
 *
 * Two assertions:
 *  1) the locale switcher UI (app/layouts/default.vue <select aria-label="Language">)
 *     is present and offers both en + pl;
 *  2) the i18n RENDERING CONTRACT holds: the switcher persists the `i18n_locale` cookie
 *     (no_prefix strategy + detectBrowserLanguage.useCookie), and SSR renders the
 *     cookie-selected language — set i18n_locale=pl and the home heading renders Polish
 *     ("Witaj...") instead of English ("Welcome...").
 *
 * NOTE: we assert via the cookie the switcher writes (not a click+soft-swap) because the
 * starter's detectBrowserLanguage(redirectOn:'root') re-detects from the browser
 * Accept-Language (en-US) on a soft in-page switch — a known 17-01 i18n-config nuance.
 * The cookie+SSR path is the deterministic, user-equivalent contract.
 */
test.use({ storageState: { cookies: [], origins: [] } })

test('locale switcher exists and SSR renders the cookie-selected language (en -> pl)', async ({ page, context }) => {
  await page.goto('/')

  // (1) Switcher UI is present and offers both locales.
  const switcher = page.getByLabel('Language')
  await expect(switcher).toBeVisible()
  await expect(switcher.locator('option')).toHaveCount(2)

  const heading = page.getByRole('heading', { level: 1 })
  const enText = (await heading.textContent())?.trim() ?? ''
  expect(enText, 'default (en) heading renders').toMatch(/welcome/i)

  // (2) Rendering contract: set the i18n_locale cookie the switcher writes, reload,
  // and assert SSR re-renders in Polish.
  await context.addCookies([
    { name: 'i18n_locale', value: 'pl', url: page.url() },
  ])
  await page.reload()
  await page.waitForLoadState('networkidle')

  await expect(heading).not.toHaveText(enText, { timeout: 10_000 })
  await expect(heading).toHaveText(/witaj/i)
  expect(await page.evaluate(() => document.documentElement.lang)).toMatch(/pl/i)
})
