import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/**
 * Backend seed helper (model: horoskopia tests/e2e/helpers/runTinker.ts).
 *
 * Drives the WinterCMS backend via `php artisan tinker --execute` to provision the
 * fixtures the backend-gated specs need:
 *   - a test user matching E2E_EMAIL / E2E_PASSWORD (login.spec.ts, auth.setup.ts)
 *   - >= 1 PUBLISHED journal post (blog.spec.ts)
 *
 * This is a DOCUMENTED, opt-in helper — it is NOT auto-run by the suite. To use it,
 * point BACKEND_CWD at your running WinterCMS checkout (env BACKEND_DIR) and call
 * seedE2EFixtures() from a setup hook, OR run the printed tinker snippet by hand.
 *
 * GUARD: every entry point is a no-op + warn when the backend is unreachable
 * (no BACKEND_DIR / no artisan / localhost:8000 down), so importing or calling it
 * in a backendless CI run never throws — it just logs and returns.
 *
 * SECURITY (T-17-12): credentials come from the env only; nothing is committed.
 */

// Resolve the backend checkout. Default mirrors the inventory superproject layout
// (this submodule lives at <inventory>/vue-starter-app); override with BACKEND_DIR.
export const BACKEND_CWD = process.env.BACKEND_DIR
  || path.resolve(__dirname, '../../../..')

const BACKEND_URL = process.env.E2E_BACKEND_URL || 'http://localhost:8000'

/** True only when an artisan-capable backend appears to be present. */
export function backendAvailable(): boolean {
  try {
    execFileSync('php', ['artisan', '--version'], {
      cwd: BACKEND_CWD,
      env: { ...process.env },
      stdio: 'ignore',
    })
    return true
  }
  catch {
    return false
  }
}

/**
 * Run a `php artisan tinker --execute <script>` subprocess. Returns trimmed stdout,
 * or '' (with a warning) when the backend is unreachable.
 *
 * Path B: single argv entry, no shell — avoids escape-cascade / parse-error issues.
 */
export function runTinker(phpScript: string): string {
  if (!backendAvailable()) {
    console.warn(
      `[runTinker] backend not reachable at ${BACKEND_CWD} (${BACKEND_URL}); skipping seed. `
      + 'Set BACKEND_DIR to a running WinterCMS checkout to enable seeding.',
    )
    return ''
  }
  try {
    const out = execFileSync(
      'php',
      ['artisan', 'tinker', '--execute', phpScript],
      { cwd: BACKEND_CWD, env: { ...process.env }, encoding: 'utf8' },
    )
    return out.trim()
  }
  catch (err) {
    console.warn(`[runTinker] tinker failed: ${(err as Error).message}`)
    return ''
  }
}

/**
 * Seed the E2E fixtures (user + >= 1 published journal post). No-op + warn when the
 * backend is down. Idempotent: uses firstOrCreate / updateOrCreate semantics.
 *
 * NOTE: the exact model FQNs are documented for reference; adjust to your backend's
 * published journal model if it differs. This snippet is the recommended seed and is
 * what blog.spec.ts / auth.setup.ts assume.
 */
export function seedE2EFixtures(): void {
  const email = process.env.E2E_EMAIL
  const password = process.env.E2E_PASSWORD
  if (!email || !password) {
    console.warn('[seedE2EFixtures] E2E_EMAIL / E2E_PASSWORD unset — nothing to seed.')
    return
  }

  // Seed (or update) the test user.
  runTinker(
    `$u = \\Golem15\\User\\Models\\User::firstOrNew(['email' => '${email}']);`
    + ` $u->password = '${password}'; $u->password_confirmation = '${password}';`
    + ` $u->is_activated = true; $u->save(); echo $u->id;`,
  )

  // Ensure >= 1 published journal post exists (blog.spec.ts asserts >= 1 item renders).
  runTinker(
    `$p = \\Golem15\\Journal\\Models\\Post::updateOrCreate(`
    + ` ['slug' => 'e2e-seed-post'],`
    + ` ['title' => 'E2E Seed Post', 'excerpt' => 'Seeded for Playwright blog.spec.ts.',`
    + `  'content_html' => '<p>Seeded post.</p>', 'published' => true,`
    + `  'published_at' => now()]); echo $p->id;`,
  )
}

if (import.meta.url === `file://${process.argv[1]}`) {
  // Allow `node tests/e2e/helpers/runTinker.ts` (or tsx) to seed on demand.
  seedE2EFixtures()
}
