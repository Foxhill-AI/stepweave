/**
 * Design Tool QA Audit
 * Tests the full design tool UX at http://localhost:3004
 * Uses a shared browser context across all tests so auth persists.
 */

import { test, expect, type Page, type BrowserContext, chromium } from '@playwright/test'
import fs from 'fs'
import path from 'path'
import sharp from 'sharp'

const BASE_URL = 'http://localhost:3004'
const TEST_EMAIL = 'playwright-test@stepweave-test.com'
const TEST_PASSWORD = 'PlaywrightTest123!'
const SCREENSHOT_DIR = path.join(__dirname, 'screenshots')

test.use({ baseURL: BASE_URL })
test.setTimeout(90_000)

// ─── helpers ──────────────────────────────────────────────────────────────

function ensureScreenshotDir() {
  if (!fs.existsSync(SCREENSHOT_DIR)) fs.mkdirSync(SCREENSHOT_DIR, { recursive: true })
}

async function shot(page: Page, label: string): Promise<string> {
  ensureScreenshotDir()
  const filename = path.join(SCREENSHOT_DIR, `${label.replace(/[^a-z0-9_-]/gi, '_')}.png`)
  await page.screenshot({ path: filename, fullPage: false })
  console.log(`[screenshot] ${filename}`)
  return filename
}

function listenConsole(page: Page): () => string[] {
  const errs: string[] = []
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()) })
  return () => errs
}

/** Dismiss cookie consent banner if visible. */
async function dismissCookieBanner(page: Page) {
  const banner = page.locator('[role="dialog"][aria-label*="Cookie"], .cookie-banner, [data-testid="cookie-banner"]').first()
  if (!(await banner.isVisible({ timeout: 1500 }).catch(() => false))) return
  // Try "Accept all" or "Accept" button inside banner
  const acceptBtn = banner.locator('button').filter({ hasText: /accept all|accept|ok|got it/i }).first()
  if (await acceptBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
    await acceptBtn.click({ force: true })
    await page.waitForTimeout(400)
    return
  }
  // Fallback: click any button in the banner
  const anyBtn = banner.locator('button').first()
  if (await anyBtn.isVisible({ timeout: 500 }).catch(() => false)) {
    await anyBtn.click({ force: true })
    await page.waitForTimeout(400)
  }
}

/** Close auth modal if open (by pressing Escape or clicking X). */
async function closeModalIfOpen(page: Page) {
  const closeBtn = page.locator('button[aria-label="Close"], button.modal-close, .modal-close-btn, button').filter({ hasText: /^×$|^✕$|^close$/i }).first()
  if (await closeBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
    await closeBtn.click()
    await page.waitForTimeout(400)
    return
  }
  // Try keyboard escape
  await page.keyboard.press('Escape')
  await page.waitForTimeout(300)
}

/** Login using the auth modal. Assumes ?openAuth=1 is appended. */
async function loginViaModal(page: Page): Promise<boolean> {
  // Go to homepage with openAuth to trigger the modal
  await page.goto(`${BASE_URL}/?openAuth=1`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1000)

  // Wait for auth modal email input
  const emailInput = page.locator('#auth-email')
  try {
    await emailInput.waitFor({ state: 'visible', timeout: 8000 })
  } catch {
    // Modal might not be open – already logged in?
    const logInBtn = page.locator('a.navbar-login-btn, button').filter({ hasText: /log.?in/i }).first()
    if (!(await logInBtn.isVisible({ timeout: 2000 }).catch(() => false))) {
      // Maybe already logged in (user avatar visible)
      const avatar = page.locator('.navbar-avatar, .user-avatar, [data-testid="user-menu"]').first()
      if (await avatar.isVisible({ timeout: 2000 }).catch(() => false)) {
        console.log('[auth] Already logged in (avatar visible)')
        return true
      }
      return false
    }
  }

  if (!(await emailInput.isVisible({ timeout: 3000 }).catch(() => false))) {
    return false
  }

  await emailInput.fill(TEST_EMAIL)
  const pwInput = page.locator('#auth-password')
  await pwInput.fill(TEST_PASSWORD)
  const submitBtn = page.locator('button.submit-button').filter({ hasText: /log.?in/i }).first()
  await submitBtn.click()
  await page.waitForTimeout(3000)

  // Check modal closed
  const modalStillOpen = await emailInput.isVisible({ timeout: 2000 }).catch(() => false)
  if (!modalStillOpen) {
    console.log('[auth] Logged in successfully')
    return true
  }

  const errEl = page.locator('.signup-error[role="alert"]')
  const errTxt = await errEl.textContent().catch(() => '')
  console.warn(`[auth] Login error: "${errTxt?.trim()}"`)
  return false
}

async function createTestImage(): Promise<string> {
  const p = '/tmp/test-image.png'
  await sharp({ create: { width: 200, height: 200, channels: 4, background: { r: 255, g: 0, b: 0, alpha: 1 } } }).png().toFile(p)
  return p
}

// ─── findings ─────────────────────────────────────────────────────────────

interface Finding {
  category: 'works' | 'broken' | 'ux_issue' | 'console_error'
  step: string
  detail: string
  screenshot?: string
}

const findings: Finding[] = []

function record(f: Finding) {
  const icons = { works: '✓', broken: '✗', ux_issue: '⚠', console_error: '!' }
  console.log(`[${icons[f.category]}][${f.category.toUpperCase()}] ${f.step}: ${f.detail}`)
  findings.push(f)
}

function writeReport() {
  const reportPath = path.join(__dirname, 'findings.md')
  const works = findings.filter((f) => f.category === 'works')
  const broken = findings.filter((f) => f.category === 'broken')
  const ux = findings.filter((f) => f.category === 'ux_issue')
  const cons = findings.filter((f) => f.category === 'console_error')

  const lines = [
    '# StepWeave Design Tool — QA Audit Report',
    '',
    `_Generated: ${new Date().toISOString()}_`,
    `_Tool: Playwright automated audit | Base URL: http://localhost:3004_`,
    '',
    '---',
    '',
    '## Summary',
    '',
    `| Category | Count |`,
    `|----------|-------|`,
    `| ✓ Works correctly | ${works.length} |`,
    `| ✗ Broken / not working | ${broken.length} |`,
    `| ⚠ UX issues / confusing | ${ux.length} |`,
    `| ! Console errors | ${cons.length} |`,
    '',
    '---',
    '',
    '## ✓ What Works',
    '',
    ...works.map((f) => `- **[${f.step}]** ${f.detail}${f.screenshot ? ` _(${path.basename(f.screenshot)})_` : ''}`),
    '',
    '---',
    '',
    '## ✗ What is Broken',
    '',
    ...broken.map((f) => `- **[${f.step}]** ${f.detail}${f.screenshot ? ` _(${path.basename(f.screenshot)})_` : ''}`),
    '',
    '---',
    '',
    '## ⚠ UX Issues / Confusing Behaviour',
    '',
    ...ux.map((f) => `- **[${f.step}]** ${f.detail}${f.screenshot ? ` _(${path.basename(f.screenshot)})_` : ''}`),
    '',
    '---',
    '',
    '## ! Console Errors',
    '',
    ...cons.map((f) => `- **[${f.step}]** \`${f.detail.split('\n')[0].substring(0, 250)}\``),
    '',
    '---',
    '',
    '## Code Fix Recommendations',
    '',
    '### BUG-1: `MediaUploaderUI.tsx` — Upload button is a confirmed no-op placeholder',
    '',
    '**File:** `components/design-tool/MediaUploaderUI.tsx` lines 29–34',
    '',
    '```tsx',
    'const handleClick = () => {',
    '  // UI only – no file picker opened   <-- dead code',
    '}',
    'const handleDrop = (e: React.DragEvent) => {',
    '  // UI only – no actual upload         <-- dead code',
    '}',
    '```',
    '',
    'The component\'s `aria-label` literally says `"Upload or drop files (UI only)"` — a dev comment exposed to assistive tech.',
    '',
    '**Fix:** Wire to a real `<input type="file" />` (copy pattern from `PreviewWorkspace.tsx`\'s `fileInputRef`) or delete this component entirely — `PreviewWorkspace` already handles uploads.',
    '',
    '### BUG-2: Auth modal blocks the model selection page after navigation',
    '',
    '**Observed:** When unauthenticated user navigates to `/design-tool/new`, the URL is rewritten to `/design-tool/new?openAuth=1`, which causes the Navbar to open the login modal. If the user then logs in, the modal closes but a second navigation to `/design-tool/new` still hits the `?openAuth=1` param (which persists in the URL). This means the auth modal re-opens every time users land on the page from a stale link or bookmark, **blocking the entire model selection grid** with a modal overlay.',
    '',
    '**Evidence:** Playwright screenshot `test-failed-1.png` shows shoe models visible behind the login modal overlay — users cannot click model cards while modal is open.',
    '',
    '**File:** `components/Navbar.tsx` lines ~137-145 / `app/design-tool/new/page.tsx` lines ~22-24',
    '',
    '```tsx',
    '// In DesignToolNewInner useEffect:',
    'if (searchParams.get(\'openAuth\') !== \'1\') {',
    '  router.replace(\'/design-tool/new?openAuth=1\')',
    '}',
    '```',
    '',
    '**Fix 1:** After the modal opens, strip the query param: `router.replace(\'/design-tool/new\')` inside the Navbar effect that reads `openAuth`.',
    '**Fix 2:** Use a modal-open state in session storage rather than a URL param.',
    '',
    '### BUG-3: Homepage shows "Loading products…" spinner visible past networkidle',
    '',
    '**File:** `app/page.tsx` — `fetchProducts` with 12s timeout on `/api/home-products`',
    '',
    'The API is slow enough (>3s in local dev) that the page reaches network idle with no products visible. Users see a blank page with a loading spinner.',
    '',
    '**Fix:** Add a loading skeleton (not raw text), or add server-side product preloading.',
    '',
    '### BUG-4: Design tool hub page cards not visible when `userAccount` is null',
    '',
    '**File:** `app/design-tool/page.tsx` — `DesignToolHubInner` checks `user` but hub cards are rendered when `!authLoading && user`',
    '',
    'After login via the modal on a different route, navigating to `/design-tool` may hit a timing window where `user` is set but `userAccount` is null (still loading), causing the hub to render the "not logged in" view briefly.',
    '',
    '**Fix:** Wait for both `user` and `!authLoading` before deciding to show the "sign in" vs hub view.',
    '',
    '### BUG-5: Auto-save failure is completely silent',
    '',
    '**File:** `components/design-tool/DesignToolPage.tsx` line ~338',
    '',
    '```tsx',
    '.catch(() => setAutoSaveState(\'idle\'))  // ← silent failure',
    '```',
    '',
    '**Fix:**',
    '```tsx',
    '.catch(() => {',
    '  setAutoSaveState(\'error\')',
    '  setTimeout(() => setAutoSaveState(\'idle\'), 3000)',
    '})',
    '// Add error render in step bar: {autoSaveState === \'error\' && <span>Save failed — check connection</span>}',
    '```',
    '',
    '### UX-1: "T Add text" uses raw letter as icon',
    '',
    '**File:** `components/design-tool/PreviewWorkspace.tsx` line ~498',
    '',
    '```tsx',
    '  T Add text  // "T" is not an icon — should be <Type size={13} aria-hidden /> from lucide-react',
    '```',
    '',
    '**Fix:** `import { Type } from \'lucide-react\'` and replace `T` with `<Type size={13} aria-hidden />`.',
    '',
    '### UX-2: "Add text" button hidden until image applied — text-only designs are impossible',
    '',
    '**File:** `components/design-tool/PreviewWorkspace.tsx` lines ~464-513',
    '',
    'Button rendered only inside `{hasImage && viewMode === "canvas" && ...}`. Users wanting to add only text to a shoe must upload an image first — even if they want a text-only design.',
    '',
    '**Fix:** Show a standalone "Add text" action that appears even when no image is uploaded. Could sit on the upload hero or a secondary toolbar.',
    '',
    '### UX-3: Preview button disabled state has no mobile-visible explanation',
    '',
    '**File:** `components/design-tool/PreviewWorkspace.tsx` line ~682',
    '',
    '```tsx',
    'title={!hasPatternImage ? \'Add a pattern first\' : undefined}',
    '```',
    '',
    'On mobile, `title` attribute tooltips never appear on tap. The button just looks broken.',
    '',
    '**Fix:** Render `<span className="preview-hint">Add an image first to preview</span>` below the button when disabled.',
    '',
    '### UX-4: Font size input has no visible unit label',
    '',
    '**File:** `components/design-tool/PreviewWorkspace.tsx` lines ~544-552',
    '',
    '"Printfile pixels" is a Printful-specific concept. End users have no context for what value to enter.',
    '',
    '**Fix:** Add a visible label `"Size (pt)"` or change units to something familiar (e.g. a percentage of the print area).',
    '',
    '### UX-5: Placement picker uses `<p>` grouping, not accessible `<fieldset>/<legend>`',
    '',
    '**File:** `components/design-tool/PreviewWorkspace.tsx` lines ~414-461',
    '',
    '```tsx',
    '// Current: <p> heading over checkboxes — screen readers won\'t associate prompt with checkboxes',
    '<p>Add image to which views?</p>',
    '// Fix:',
    '<fieldset><legend>Add image to which views?</legend>...',
    '```',
    '',
    '### UX-6: "Finish →" publish CTA only in step bar — hard to find on mobile',
    '',
    '**File:** `components/design-tool/DesignToolPage.tsx` lines ~729-737',
    '',
    'The only publish path on the customize step is a small button in the top step bar. Consider a more prominent CTA at the bottom of the canvas.',
    '',
    '### UX-7: React hydration mismatch in Footer on every page load',
    '',
    '**File:** `components/Footer.tsx` — newsletter `<input>` has an extra `style` attribute on server',
    '',
    'Console error: `Warning: Extra attributes from the server: style at input at form at div ... at Footer`',
    '',
    '**Fix:** Audit `Footer.tsx` for any style/attribute that uses `window` or browser-only APIs on first render. Wrap such code in `useEffect` or `typeof window !== "undefined"` guards.',
    '',
    '### UX-8: Auth redirect URL pollution — `?openAuth=1` persists in address bar',
    '',
    '**File:** `components/Navbar.tsx` lines ~137-145',
    '',
    'After the auth modal is triggered and the user logs in, the URL remains `.../design-tool/new?openAuth=1`. Bookmarking or sharing this URL will always re-open the modal.',
    '',
    '**Fix:** After modal opens, `router.replace(pathname)` to strip the `openAuth` param.',
    '',
    '### ACCESSIBILITY-1: Upload drop zone uses `div[role=button]` instead of native `<button>`',
    '',
    '**File:** `components/design-tool/PreviewWorkspace.tsx` lines ~377-403',
    '',
    'The hidden `<input type="file">` is `aria-hidden`, so screen readers can only access the upload via the `div[role=button]`. Some screen readers handle this inconsistently.',
    '',
    '**Fix:** Use a `<label>` wrapping `<input type="file">` — the most accessible upload pattern. Or replace the div with a native `<button>` that triggers `fileInputRef.current?.click()`.',
    '',
    '### ACCESSIBILITY-2: Cookie consent banner on mobile can block auth modal interactions',
    '',
    '**Observed:** On 375x812 viewport, the cookie consent banner ("We use cookies") renders at the bottom of the screen behind the modal. In Playwright, auth-related click events on form fields behind the cookie banner were blocked.',
    '',
    '**Fix:** Ensure the cookie consent banner has a lower z-index than the auth modal overlay.',
    '',
    '---',
    '',
    '## Screenshots',
    '',
    ...findings.filter(f => f.screenshot).map(f => `- \`${path.basename(f.screenshot!)}\` — [${f.category}] ${f.step}`),
  ]

  fs.writeFileSync(reportPath, lines.join('\n'), 'utf-8')
  console.log(`\n[report] Written to ${reportPath}`)
}

// ─── Shared state ─────────────────────────────────────────────────────────

let sharedContext: BrowserContext | null = null
let sharedPage: Page | null = null
let _draftUrl: string | null = null
let _authReady = false
let _testImagePath = '/tmp/test-image.png'

// ─── suite ────────────────────────────────────────────────────────────────

test.describe('Design Tool QA Audit', () => {
  test.beforeAll(async ({ browser }) => {
    _testImagePath = await createTestImage()

    // Create a persistent context so auth cookies survive across tests
    sharedContext = await browser.newContext({
      viewport: { width: 1280, height: 800 },
    })
    sharedPage = await sharedContext.newPage()

    // Log in once
    _authReady = await loginViaModal(sharedPage)
    if (_authReady) {
      // Wait for redirect/home after login
      await sharedPage.waitForTimeout(1500)
      // Dismiss cookie banner so it doesn't block subsequent interactions
      await dismissCookieBanner(sharedPage)
      console.log('[setup] Auth ready. Current URL:', sharedPage.url())
    } else {
      console.warn('[setup] Auth failed — tests will report broken')
    }
  })

  test.afterAll(async () => {
    writeReport()
    if (sharedContext) await sharedContext.close().catch(() => {})
  })

  test.afterEach(async () => {
    writeReport()
  })

  // ── 01: Homepage ──────────────────────────────────────────────────────────
  test('01 - Homepage loads', async ({ page }) => {
    const getErrors = listenConsole(page)
    await page.goto(BASE_URL, { waitUntil: 'networkidle' })
    const sc = await shot(page, '01-homepage')

    const title = await page.title()
    record({ category: title.toLowerCase().includes('step') ? 'works' : 'broken', step: '01-homepage', detail: `Title: "${title}"`, screenshot: sc })

    const nav = page.locator('nav, .navbar').first()
    if (await nav.isVisible().catch(() => false)) {
      record({ category: 'works', step: '01-homepage', detail: 'Navigation bar visible' })
    } else {
      record({ category: 'broken', step: '01-homepage', detail: 'Navigation bar not visible', screenshot: sc })
    }

    const loading = page.locator('.homepage-loading')
    if (await loading.isVisible().catch(() => false)) {
      record({ category: 'ux_issue', step: '01-homepage', detail: '"Loading products…" still shown after networkidle — /api/home-products is slow (may take >3s in dev). Users see a blank page.', screenshot: sc })
    } else {
      record({ category: 'works', step: '01-homepage', detail: 'Products loaded (no loading spinner visible after networkidle)' })
    }

    for (const e of getErrors()) {
      if (e.includes('Extra attributes') || e.includes('hydration')) {
        record({ category: 'console_error', step: '01-homepage', detail: `Hydration mismatch in Footer: ${e.substring(0, 200)}` })
      } else {
        record({ category: 'console_error', step: '01-homepage', detail: e.substring(0, 300) })
      }
    }
  })

  // ── 02: Auth ──────────────────────────────────────────────────────────────
  test('02 - Auth (login)', async () => {
    // Auth is done in beforeAll using sharedPage. Report the result.
    if (_authReady) {
      const sc = await shot(sharedPage!, '02-auth-success')
      record({ category: 'works', step: '02-auth', detail: 'Login with test credentials succeeded (modal closed, session active)', screenshot: sc })
    } else {
      record({ category: 'broken', step: '02-auth', detail: `Login failed for ${TEST_EMAIL} — Supabase may require email verification or account doesn't exist` })
    }
  })

  // ── 03: Design Tool hub ────────────────────────────────────────────────────
  test('03 - Design Tool hub page', async () => {
    if (!_authReady || !sharedPage) {
      record({ category: 'broken', step: '03-design-hub', detail: 'Not authenticated — skipping' })
      return
    }
    const page = sharedPage
    const getErrors = listenConsole(page)

    await page.goto(`${BASE_URL}/design-tool`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(1000)
    const sc = await shot(page, '03-design-hub')

    const url = page.url()
    if (url.includes('openAuth')) {
      record({ category: 'broken', step: '03-design-hub', detail: `Redirected to login despite auth — auth session may have expired (URL: ${url})`, screenshot: sc })
      return
    }

    const h1 = (await page.locator('h1').first().textContent().catch(() => ''))?.trim()
    record({ category: h1?.toLowerCase().includes('design') ? 'works' : 'ux_issue', step: '03-design-hub', detail: `H1: "${h1}"`, screenshot: sc })

    const newCard = page.locator('a[href*="/design-tool/new"]').first()
    const draftsCard = page.locator('a[href*="/design-tool/drafts"]').first()

    if (await newCard.isVisible().catch(() => false)) {
      record({ category: 'works', step: '03-design-hub', detail: '"Start new design" card visible and links to /design-tool/new' })
    } else {
      record({ category: 'broken', step: '03-design-hub', detail: '"Start new design" card not visible — user may not be recognized as logged in on hub page', screenshot: sc })
      // Debug: check for the dt-hub-hero which is always shown
      const hero = page.locator('.dt-hub-hero')
      if (await hero.isVisible().catch(() => false)) {
        const heroTxt = await hero.textContent()
        record({ category: 'ux_issue', step: '03-design-hub', detail: `Hub hero shows: "${heroTxt?.trim().substring(0, 150)}"` })
      }
    }

    if (await draftsCard.isVisible().catch(() => false)) {
      record({ category: 'works', step: '03-design-hub', detail: '"My drafts" card visible' })
    }

    for (const e of getErrors()) record({ category: 'console_error', step: '03-design-hub', detail: e.substring(0, 300) })
  })

  // ── 04: Model selection ───────────────────────────────────────────────────
  test('04 - Shoe model selection', async () => {
    if (!_authReady || !sharedPage) {
      record({ category: 'broken', step: '04-model-selection', detail: 'Not authenticated — skipping' })
      return
    }
    const page = sharedPage
    const getErrors = listenConsole(page)

    await page.goto(`${BASE_URL}/design-tool/new`, { waitUntil: 'domcontentloaded' })
    // IMPORTANT: close modal if it opened due to ?openAuth=1 trigger from redirect
    await page.waitForTimeout(2000)
    await closeModalIfOpen(page)

    // Wait for products to load
    await page.waitForTimeout(3000)
    let sc = await shot(page, '04-model-selection')

    const modelCards = page.locator('.base-model-card')
    const count = await modelCards.count()

    if (count === 0) {
      const err = page.locator('.design-tool-form-error')
      const errTxt = await err.textContent().catch(() => '')
      record({ category: 'broken', step: '04-model-selection', detail: `No model cards (${errTxt?.trim() || 'no error shown'})`, screenshot: sc })
      return
    }

    record({ category: 'works', step: '04-model-selection', detail: `${count} shoe model card(s) visible`, screenshot: sc })

    // Select first model with force (in case modal overlay briefly present)
    await modelCards.first().click({ force: true })
    await page.waitForTimeout(500)
    sc = await shot(page, '04b-model-selected')

    const selected = page.locator('.base-model-card--selected, [aria-selected="true"]')
    if (await selected.isVisible().catch(() => false)) {
      const modelName = await selected.locator('.base-model-card-name').textContent().catch(() => 'unknown')
      record({ category: 'works', step: '04-model-selection', detail: `Model selected: "${modelName?.trim()}" — card shows selected state`, screenshot: sc })
    } else {
      record({ category: 'broken', step: '04-model-selection', detail: 'No selected state after clicking model card (aria-selected or --selected class)', screenshot: sc })
    }

    // Color section
    const colorCards = page.locator('.base-model-color-card')
    if ((await colorCards.count()) >= 2) {
      record({ category: 'works', step: '04-model-selection', detail: 'Structural color section (White/Black) visible below model grid' })
    } else {
      record({ category: 'ux_issue', step: '04-model-selection', detail: 'Color selection not visible or < 2 options', screenshot: sc })
    }

    // Continue
    const continueBtn = page.locator('button.base-model-continue-btn')
    if (await continueBtn.isVisible().catch(() => false)) {
      const enabled = await continueBtn.isEnabled().catch(() => false)
      if (enabled) {
        record({ category: 'works', step: '04-model-selection', detail: '"Continue" button enabled after model selection' })
        // Dismiss cookie banner that may block the button click
        await dismissCookieBanner(page)
        await continueBtn.click({ force: true })
        try {
          await page.waitForURL(/\/design-tool\/\d+/, { timeout: 20000 })
          _draftUrl = page.url()
          record({ category: 'works', step: '04-model-selection', detail: `Draft created, navigated to: ${_draftUrl}` })
        } catch {
          sc = await shot(page, '04c-navigation-timeout')
          record({ category: 'broken', step: '04-model-selection', detail: 'Timeout waiting for draft URL after Continue click', screenshot: sc })
        }
      } else {
        record({ category: 'broken', step: '04-model-selection', detail: '"Continue" button disabled after model selection', screenshot: sc })
      }
    } else {
      record({ category: 'broken', step: '04-model-selection', detail: '"Continue" button not found', screenshot: sc })
    }

    for (const e of getErrors()) record({ category: 'console_error', step: '04-model-selection', detail: e.substring(0, 300) })
  })

  // ── 05: Design step ───────────────────────────────────────────────────────
  test('05 - Design step (AI panel)', async () => {
    if (!_authReady || !sharedPage || !_draftUrl) {
      record({ category: 'broken', step: '05-design-step', detail: !_draftUrl ? 'No draft URL (test 04 failed)' : 'Not auth' })
      return
    }
    const page = sharedPage
    const getErrors = listenConsole(page)

    await page.goto(_draftUrl, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(2000)
    const sc = await shot(page, '05-design-step')

    record({ category: 'works', step: '05-design-step', detail: `Draft editor loaded at ${page.url()}`, screenshot: sc })

    // Step bar
    const stepBar = page.locator('.design-tool-step-bar')
    if (await stepBar.isVisible().catch(() => false)) {
      const txt = (await stepBar.textContent())?.replace(/\s+/g, ' ').trim()
      record({ category: 'works', step: '05-design-step', detail: `Step bar: "${txt}"` })

      // Back link
      const backLink = page.locator('.design-tool-back-link')
      if (await backLink.isVisible().catch(() => false)) {
        const backTxt = await backLink.textContent()
        record({ category: 'works', step: '05-design-step', detail: `Back link visible: "${backTxt?.trim()}"` })
      } else {
        record({ category: 'ux_issue', step: '05-design-step', detail: '"← Change shoe" back link not visible in step bar' })
      }
    } else {
      record({ category: 'ux_issue', step: '05-design-step', detail: 'Step bar not visible on draft page', screenshot: sc })
    }

    // AI Panel
    const aiPanel = page.locator('.ai-prompt-panel')
    if (await aiPanel.isVisible().catch(() => false)) {
      record({ category: 'works', step: '05-design-step', detail: 'AI prompt panel visible (Design step is first)' })

      const promptTA = page.locator('#ai-prompt-input')
      if (await promptTA.isVisible().catch(() => false)) {
        const ph = await promptTA.getAttribute('placeholder')
        record({ category: 'works', step: '05-design-step', detail: `Prompt textarea visible (placeholder: "${ph}")` })
      } else {
        record({ category: 'broken', step: '05-design-step', detail: 'Prompt textarea not found in AI panel', screenshot: sc })
      }

      const genBtn = page.locator('button.ai-prompt-btn').filter({ hasText: /^generate$/i }).first()
      if (await genBtn.isVisible().catch(() => false)) {
        const disabled = await genBtn.isDisabled().catch(() => false)
        record({ category: disabled ? 'works' : 'ux_issue', step: '05-design-step', detail: disabled ? '"Generate" button correctly disabled with empty prompt' : '"Generate" button NOT disabled with empty prompt — could cause empty generation request' })
      } else {
        record({ category: 'broken', step: '05-design-step', detail: '"Generate" button not found' })
      }

      const attachBtn = page.locator('.ai-prompt-attach-btn')
      if (await attachBtn.isVisible().catch(() => false)) {
        record({ category: 'works', step: '05-design-step', detail: '"Attach photo" button visible' })
        const attachHint = page.locator('.ai-prompt-attach-hint')
        if (await attachHint.isVisible().catch(() => false)) {
          const hint = await attachHint.textContent()
          record({ category: 'works', step: '05-design-step', detail: `Attach hint: "${hint?.trim()}"` })
        }
      } else {
        record({ category: 'ux_issue', step: '05-design-step', detail: '"Attach photo" button not visible' })
      }
    } else {
      // May have jumped to customize step
      const customizeCanvas = page.locator('.design-customize-canvas')
      if (await customizeCanvas.isVisible().catch(() => false)) {
        record({ category: 'works', step: '05-design-step', detail: 'Draft already has pattern — jumped to Customize step directly' })
      } else {
        record({ category: 'broken', step: '05-design-step', detail: 'Neither AI panel nor customize canvas visible', screenshot: sc })
      }
    }

    for (const e of getErrors()) record({ category: 'console_error', step: '05-design-step', detail: e.substring(0, 300) })
  })

  // ── 06: Customize step + upload ───────────────────────────────────────────
  test('06 - Customize step and image upload', async () => {
    if (!_authReady || !sharedPage || !_draftUrl) {
      record({ category: 'broken', step: '06-customize', detail: !_draftUrl ? 'No draft URL' : 'Not auth' })
      return
    }
    const page = sharedPage
    const getErrors = listenConsole(page)

    // Navigate to draft — wait for design tool content (step bar) to be fully loaded
    await page.goto(_draftUrl, { waitUntil: 'domcontentloaded' })
    try {
      await page.locator('.design-tool-step-bar').waitFor({ state: 'visible', timeout: 15000 })
    } catch {
      const sc = await shot(page, '06-loading-timeout')
      record({ category: 'broken', step: '06-customize', detail: 'Design tool step bar never appeared — page stuck on Loading...', screenshot: sc })
      return
    }
    await page.waitForTimeout(500)

    // NOTE: "Customize" in the step bar is a <span>, not a button — it is NOT directly clickable.
    // The only way to reach Customize without AI generation is via the "Attach photo" → "Place on shoe"
    // → "Next" flow in the AI panel. We record this as a UX issue.
    record({ category: 'ux_issue', step: '06-customize', detail: '"Customize" in the step bar is a non-interactive <span>, not a <button>. Users can only reach the Customize step via the AI panel flow (generate or attach+place), not by clicking the step label directly.' })

    // Use the AI panel "Attach photo" flow to go to Customize.
    // 1. Find and click "Attach photo"
    const attachBtn = page.locator('.ai-prompt-attach-btn')
    if (!(await attachBtn.isVisible({ timeout: 5000 }).catch(() => false))) {
      const sc = await shot(page, '06-no-attach-btn')
      record({ category: 'broken', step: '06-customize', detail: '"Attach photo" button not visible — cannot reach Customize step', screenshot: sc })
      return
    }

    // The attach button triggers a hidden file input inside the AI panel
    const aiFileInput = page.locator('input[type="file"]').first()
    await aiFileInput.setInputFiles(_testImagePath)
    // Wait for upload to complete — the choice buttons appear only after upload finishes
    // (referenceUploading goes false, then "What would you like to do?" panel shows)
    await page.waitForTimeout(500)
    const uploading = page.locator('.ai-prompt-reference-uploading')
    if (await uploading.isVisible({ timeout: 3000 }).catch(() => false)) {
      // Wait for uploading spinner to disappear (max 15s)
      await uploading.waitFor({ state: 'hidden', timeout: 15000 }).catch(() => {})
    }
    await page.waitForTimeout(500)

    // 2. Check for photo choice panel — choose "Put it on my shoes" (direct mode)
    const placeOnShoeBtn = page.locator('.ai-prompt-photo-choice-btn').filter({ hasText: /put it on my shoes|place on shoe/i }).first()
    if (await placeOnShoeBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      const btnLabel = await placeOnShoeBtn.textContent()
      record({ category: 'works', step: '06-customize', detail: `Photo choice appeared after upload: "${btnLabel?.trim()}" / "Use as AI inspiration"` })
      await placeOnShoeBtn.click()
      await page.waitForTimeout(500)
    } else {
      // Log all visible choice buttons for diagnosis
      const allChoiceBtns = page.locator('.ai-prompt-photo-choice-btn')
      const count = await allChoiceBtns.count()
      const labels: string[] = []
      for (let i = 0; i < count; i++) labels.push((await allChoiceBtns.nth(i).textContent())?.trim() ?? '')
      record({ category: 'ux_issue', step: '06-customize', detail: `Photo choice buttons (${count}): [${labels.join(', ')}] — expected "Put it on my shoes"`, screenshot: await shot(page, '06-no-photo-choice') })
    }

    // 3. Click "Continue to customize →" to transition to Customize
    const nextBtn = page.locator('.ai-prompt-next-btn').first()
    if (await nextBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      const nextBtnLabel = await nextBtn.textContent()
      record({ category: 'works', step: '06-customize', detail: `"${nextBtnLabel?.trim()}" button appears after "Put it on my shoes" selection (canGoNext = true)` })
      await nextBtn.click()
      // Wait for Customize step to render
      try {
        await page.locator('.preview-workspace').waitFor({ state: 'visible', timeout: 15000 })
      } catch {
        // May have gone directly or taken longer
      }
      await page.waitForTimeout(1000)
    } else {
      const sc = await shot(page, '06-no-next-btn')
      record({ category: 'broken', step: '06-customize', detail: '"Continue to customize →" button not visible after choosing "Put it on my shoes" — cannot transition to Customize step', screenshot: sc })
      return
    }

    let sc = await shot(page, '06-customize-step')

    // Canvas visible?
    const workspace = page.locator('.preview-workspace')
    if (await workspace.isVisible().catch(() => false)) {
      record({ category: 'works', step: '06-customize', detail: 'Preview workspace visible on Customize step', screenshot: sc })
    } else {
      record({ category: 'broken', step: '06-customize', detail: 'Preview workspace not visible after switching to Customize step', screenshot: sc })
    }

    // Upload hero
    const uploadHero = page.locator('.preview-upload-hero')
    if (await uploadHero.isVisible().catch(() => false)) {
      const title = await uploadHero.locator('.preview-upload-hero-title').textContent().catch(() => '')
      const hint = await uploadHero.locator('.preview-upload-hero-hint').textContent().catch(() => '')
      const meta = await uploadHero.locator('.preview-upload-hero-meta').textContent().catch(() => '')
      record({ category: 'works', step: '06-customize', detail: `Upload hero visible: title="${title?.trim()}" | hint="${hint?.trim()}" | meta="${meta?.trim()}"` })
    }

    // Preview button disabled?
    const previewBtn = page.locator('.preview-canvas-header-preview-btn')
    if (await previewBtn.isVisible().catch(() => false)) {
      const disabled = await previewBtn.isDisabled().catch(() => false)
      const titleAttr = await previewBtn.getAttribute('title')
      record({
        category: disabled ? 'works' : 'ux_issue',
        step: '06-customize',
        detail: disabled ? `"Preview →" disabled before upload (tooltip: "${titleAttr}")` : '"Preview →" NOT disabled before upload',
      })
      if (disabled && !titleAttr) {
        record({ category: 'ux_issue', step: '06-customize', detail: 'Preview button disabled but has NO title tooltip — mobile users get zero feedback on why button is disabled' })
      }
    } else {
      record({ category: 'ux_issue', step: '06-customize', detail: '"Preview →" button not visible — templates may still be loading' })
    }

    // Placement tabs
    const tabs = page.locator('[role="tablist"] button.shoe-design-tab')
    const tabCount = await tabs.count()
    if (tabCount > 0) {
      const names: string[] = []
      for (let i = 0; i < tabCount; i++) names.push((await tabs.nth(i).textContent())?.trim() ?? '')
      record({ category: 'works', step: '06-customize', detail: `Placement tabs: [${names.join(', ')}]` })
    } else {
      record({ category: 'ux_issue', step: '06-customize', detail: 'No placement tabs visible — Printful templates may not have loaded', screenshot: sc })
    }

    // Upload test image
    const fileInput = page.locator('input[type="file"].preview-canvas-file-input').first()
    if ((await fileInput.count()) === 0) {
      sc = await shot(page, '06-no-file-input')
      record({ category: 'broken', step: '06-customize', detail: 'No hidden file input found — image upload not possible', screenshot: sc })
      return
    }

    record({ category: 'works', step: '06-customize', detail: 'Hidden file input (preview-canvas-file-input) present for image upload' })

    await fileInput.setInputFiles(_testImagePath)
    await page.waitForTimeout(4000)
    sc = await shot(page, '06-after-upload')

    // Upload error?
    const uploadErr = page.locator('.preview-canvas-error[role="alert"]')
    if (await uploadErr.isVisible().catch(() => false)) {
      const msg = await uploadErr.textContent()
      record({ category: 'broken', step: '06-customize', detail: `Upload error shown: "${msg?.trim()}"`, screenshot: sc })
      return
    }

    // Placement picker
    const picker = page.locator('.preview-placement-picker')
    if (await picker.isVisible().catch(() => false)) {
      record({ category: 'works', step: '06-customize', detail: 'Placement picker shown after upload (multiple views detected)' })
      const addBtn = page.locator('.preview-text-panel-actions button').filter({ hasText: /add to/i }).first()
      if (await addBtn.isVisible().catch(() => false)) {
        const btnTxt = await addBtn.textContent()
        record({ category: 'works', step: '06-customize', detail: `Placement confirm button: "${btnTxt?.trim()}"` })
        await addBtn.click()
        await page.waitForTimeout(2000)
        sc = await shot(page, '06-after-placement-confirm')
      }
    }

    // Image bar
    const imageBar = page.locator('.preview-image-bar')
    if (await imageBar.isVisible().catch(() => false)) {
      const barTxt = (await imageBar.textContent())?.replace(/\s+/g, ' ').trim()
      record({ category: 'works', step: '06-customize', detail: `Image bar visible: "${barTxt}"`, screenshot: sc })

      // "T Add text" button
      const addTextBtn = page.locator('.preview-image-bar-btn').filter({ hasText: /add text/i }).first()
      if (await addTextBtn.isVisible().catch(() => false)) {
        const btnTxt = await addTextBtn.textContent()
        record({ category: 'works', step: '06-customize', detail: '"Add text" button visible in image bar' })
        if (btnTxt?.trim().startsWith('T ')) {
          record({ category: 'ux_issue', step: '06-customize', detail: `"Add text" button has raw "T" character as icon: "${btnTxt?.trim()}" — should use SVG (lucide Type icon)` })
        }
      } else {
        record({ category: 'ux_issue', step: '06-customize', detail: '"Add text" button NOT visible even after image applied — text layer feature may be missing' })
      }

      // Remove button
      const removeBtn = page.locator('.preview-image-bar-btn--remove')
      if (await removeBtn.isVisible().catch(() => false)) {
        const removeLabel = await removeBtn.getAttribute('aria-label')
        record({ category: 'works', step: '06-customize', detail: `Remove button visible (aria-label: "${removeLabel}")` })
      }
    } else {
      record({ category: 'broken', step: '06-customize', detail: 'Image bar did NOT appear after upload — image may not have been applied', screenshot: sc })
    }

    // Shoe canvas
    const shoeCanvas = page.locator('.preview-shoe-canvas-section')
    if (await shoeCanvas.isVisible().catch(() => false)) {
      record({ category: 'works', step: '06-customize', detail: 'Shoe canvas (template editor) visible after upload' })
      const artLayers = page.locator('.placement-canvas-art-target')
      const layerCount = await artLayers.count()
      if (layerCount > 0) {
        record({ category: 'works', step: '06-customize', detail: `${layerCount} image layer(s) on canvas after upload`, screenshot: sc })
      } else {
        record({ category: 'broken', step: '06-customize', detail: 'No canvas art layers found despite image bar showing content', screenshot: sc })
      }
    } else {
      record({ category: 'broken', step: '06-customize', detail: 'Shoe canvas section NOT visible after upload', screenshot: sc })
    }

    for (const e of getErrors()) record({ category: 'console_error', step: '06-customize', detail: e.substring(0, 300) })
  })

  // ── 07: Select image layer ────────────────────────────────────────────────
  test('07 - Click image layer to select it', async () => {
    if (!_authReady || !sharedPage || !_draftUrl) {
      record({ category: 'broken', step: '07-select-image', detail: 'No draft URL — skipping' })
      return
    }
    const page = sharedPage
    const getErrors = listenConsole(page)

    // Switch to customize (may already be there)
    const customizeBtn = page.locator('button.design-tool-step--btn').filter({ hasText: /customize/i }).first()
    if (await customizeBtn.isVisible().catch(() => false)) {
      await customizeBtn.click()
      await page.waitForTimeout(600)
    }

    const artLayers = page.locator('.placement-canvas-art-target')
    if ((await artLayers.count()) === 0) {
      const sc = await shot(page, '07-no-layers')
      record({ category: 'broken', step: '07-select-image', detail: 'No art layers on canvas (upload may not have worked in test 06)', screenshot: sc })
      return
    }

    // Click first layer
    await artLayers.first().click({ force: true })
    await page.waitForTimeout(500)
    const sc = await shot(page, '07-layer-selected')

    const moveable = page.locator('.moveable-control-box')
    const selectedCls = page.locator('.placement-canvas-art--selected')

    if (await moveable.isVisible().catch(() => false)) {
      record({ category: 'works', step: '07-select-image', detail: 'Moveable selection handles appear on image layer click', screenshot: sc })
    } else if (await selectedCls.isVisible().catch(() => false)) {
      record({ category: 'works', step: '07-select-image', detail: 'Image layer gets --selected CSS class on click (auto-selected for single layer)', screenshot: sc })
    } else {
      record({ category: 'broken', step: '07-select-image', detail: 'No selection state after clicking image layer (no Moveable, no --selected class)', screenshot: sc })
    }

    // Toolbar
    const toolbar = page.locator('.placement-layer-toolbar')
    if (await toolbar.isVisible().catch(() => false)) {
      record({ category: 'works', step: '07-select-image', detail: 'Layer toolbar (flip/opacity/duplicate/delete) appears on selection' })
    } else {
      record({ category: 'ux_issue', step: '07-select-image', detail: 'Layer toolbar NOT visible after selecting image layer', screenshot: sc })
    }

    for (const e of getErrors()) record({ category: 'console_error', step: '07-select-image', detail: e.substring(0, 300) })
  })

  // ── 08: Drag image layer ───────────────────────────────────────────────────
  test('08 - Drag image layer on canvas', async () => {
    if (!_authReady || !sharedPage || !_draftUrl) {
      record({ category: 'broken', step: '08-drag', detail: 'No draft URL — skipping' })
      return
    }
    const page = sharedPage
    const getErrors = listenConsole(page)

    const artLayer = page.locator('.placement-canvas-art-target').first()
    if (!(await artLayer.isVisible().catch(() => false))) {
      const sc = await shot(page, '08-no-layer')
      record({ category: 'broken', step: '08-drag', detail: 'No art layer to drag', screenshot: sc })
      return
    }

    const box = await artLayer.boundingBox()
    if (!box) {
      record({ category: 'broken', step: '08-drag', detail: 'No bounding box for art layer' })
      return
    }

    const cx = box.x + box.width / 2
    const cy = box.y + box.height / 2

    await page.mouse.move(cx, cy)
    await page.mouse.down()
    await page.waitForTimeout(50)
    await page.mouse.move(cx + 40, cy + 30, { steps: 10 })
    await page.waitForTimeout(150)
    await page.mouse.up()
    await page.waitForTimeout(600)

    const sc = await shot(page, '08-after-drag')
    const newBox = await artLayer.boundingBox()

    if (newBox) {
      const dx = Math.abs(newBox.x - box.x)
      const dy = Math.abs(newBox.y - box.y)
      if (dx > 3 || dy > 3) {
        record({ category: 'works', step: '08-drag', detail: `Image layer moved Δx=${Math.round(dx)}px Δy=${Math.round(dy)}px`, screenshot: sc })
      } else {
        record({ category: 'broken', step: '08-drag', detail: `Drag did not move layer (Δx=${Math.round(dx)}px Δy=${Math.round(dy)}px) — Moveable may need layer to be selected first`, screenshot: sc })
      }
    } else {
      record({ category: 'broken', step: '08-drag', detail: 'Layer disappeared after drag', screenshot: sc })
    }

    for (const e of getErrors()) record({ category: 'console_error', step: '08-drag', detail: e.substring(0, 300) })
  })

  // ── 09: Add text layer ─────────────────────────────────────────────────────
  test('09 - Add text layer', async () => {
    if (!_authReady || !sharedPage || !_draftUrl) {
      record({ category: 'broken', step: '09-text', detail: 'No draft URL — skipping' })
      return
    }
    const page = sharedPage
    const getErrors = listenConsole(page)

    const imageBar = page.locator('.preview-image-bar')
    if (!(await imageBar.isVisible().catch(() => false))) {
      const sc = await shot(page, '09-no-image-bar')
      record({ category: 'broken', step: '09-text', detail: 'Image bar not visible — image may not be applied (test 06 may have failed)', screenshot: sc })
      record({ category: 'ux_issue', step: '09-text', detail: '"Add text" button requires image to be uploaded first — text-only shoe designs are not possible' })
      return
    }

    const addTextBtn = page.locator('.preview-image-bar-btn').filter({ hasText: /add text/i }).first()
    if (!(await addTextBtn.isVisible().catch(() => false))) {
      const sc = await shot(page, '09-no-add-text-btn')
      record({ category: 'broken', step: '09-text', detail: '"Add text" button not found in image bar', screenshot: sc })
      record({ category: 'ux_issue', step: '09-text', detail: '"Add text" button only shown when hasImage && viewMode===canvas — prevents text-only designs' })
      return
    }

    record({ category: 'works', step: '09-text', detail: '"Add text" button visible in image bar (appears after image upload)' })

    await addTextBtn.click()
    await page.waitForTimeout(400)
    let sc = await shot(page, '09-text-panel')

    const textPanel = page.locator('.preview-text-panel')
    if (!(await textPanel.isVisible().catch(() => false))) {
      record({ category: 'broken', step: '09-text', detail: 'Text panel did not open after clicking "Add text"', screenshot: sc })
      return
    }

    record({ category: 'works', step: '09-text', detail: 'Text add panel opened', screenshot: sc })

    // Fill text
    const textInp = page.locator('.preview-text-panel-input').first()
    if (await textInp.isVisible().catch(() => false)) {
      await textInp.fill('Hello Shoe')
      record({ category: 'works', step: '09-text', detail: 'Text input accepts keyboard input' })
    }

    // Font selector
    const fontSel = page.locator('.preview-text-panel-font').first()
    if (await fontSel.isVisible().catch(() => false)) {
      const optCount = await fontSel.locator('option').count()
      record({ category: 'works', step: '09-text', detail: `Font selector has ${optCount} options` })
    }

    // Size input
    const sizeInp = page.locator('.preview-text-panel-size').first()
    if (await sizeInp.isVisible().catch(() => false)) {
      const val = await sizeInp.inputValue()
      const titleAttr = await sizeInp.getAttribute('title')
      record({ category: 'works', step: '09-text', detail: `Font size input visible (value: ${val})` })
      record({ category: 'ux_issue', step: '09-text', detail: `Font size unit is tooltip-only ("${titleAttr}") — "printfile pixels" is a technical concept unknown to end users. No visible unit label.` })
    }

    // Color picker
    const colorInp = page.locator('.preview-text-panel-color').first()
    if (await colorInp.isVisible().catch(() => false)) {
      record({ category: 'works', step: '09-text', detail: 'Color picker visible in text panel' })
    }

    // Confirm
    const confirmBtn = page.locator('.preview-text-panel-actions button').filter({ hasText: /^add text$/i }).first()
    if (!(await confirmBtn.isVisible().catch(() => false))) {
      record({ category: 'broken', step: '09-text', detail: '"Add text" confirm button not found' })
      return
    }

    const isDisabled = await confirmBtn.isDisabled().catch(() => false)
    if (isDisabled) {
      record({ category: 'broken', step: '09-text', detail: '"Add text" confirm button disabled despite text entered' })
      return
    }

    await confirmBtn.click()
    await page.waitForTimeout(500)
    sc = await shot(page, '09-text-added')

    const textLayer = page.locator('.placement-canvas-text-target')
    if (await textLayer.isVisible().catch(() => false)) {
      const label = await textLayer.getAttribute('aria-label')
      record({ category: 'works', step: '09-text', detail: `Text layer on canvas: "${label}"`, screenshot: sc })
    } else {
      record({ category: 'broken', step: '09-text', detail: 'Text layer not found on canvas after adding', screenshot: sc })
    }

    for (const e of getErrors()) record({ category: 'console_error', step: '09-text', detail: e.substring(0, 300) })
  })

  // ── 10: Select text layer independently ────────────────────────────────────
  test('10 - Select text layer independently from image', async () => {
    if (!_authReady || !sharedPage || !_draftUrl) {
      record({ category: 'broken', step: '10-select-text', detail: 'No draft URL — skipping' })
      return
    }
    const page = sharedPage
    const getErrors = listenConsole(page)

    const textLayers = page.locator('.placement-canvas-text-target')
    const imageLayers = page.locator('.placement-canvas-art-target')
    const textCount = await textLayers.count()
    const imgCount = await imageLayers.count()

    if (textCount === 0) {
      const sc = await shot(page, '10-no-text-layer')
      record({ category: 'broken', step: '10-select-text', detail: `No text layers on canvas (text: ${textCount}, img: ${imgCount}) — test 09 may have failed`, screenshot: sc })
      return
    }

    record({ category: 'works', step: '10-select-text', detail: `Canvas has ${textCount} text and ${imgCount} image layer(s)` })

    // Click text layer to select it
    await textLayers.first().click({ force: true })
    await page.waitForTimeout(400)
    const sc = await shot(page, '10-text-selected')

    const selText = page.locator('.placement-canvas-text-target.placement-canvas-art--selected')
    const moveable = page.locator('.moveable-control-box')

    if (await selText.isVisible().catch(() => false)) {
      record({ category: 'works', step: '10-select-text', detail: 'Text layer gets --selected class on click', screenshot: sc })
    } else if (await moveable.isVisible().catch(() => false)) {
      record({ category: 'works', step: '10-select-text', detail: 'Moveable handles visible after clicking text layer', screenshot: sc })
    } else {
      record({ category: 'broken', step: '10-select-text', detail: 'Clicking text layer shows no selection state', screenshot: sc })
    }

    // Inline edit panel
    const editPanel = page.locator('.preview-text-panel')
    if (await editPanel.isVisible().catch(() => false)) {
      const editInp = page.locator('.preview-text-panel-input').first()
      const val = await editInp.inputValue().catch(() => '')
      record({ category: 'works', step: '10-select-text', detail: `Text inline edit panel appears (current text: "${val}")`, screenshot: sc })
    } else {
      record({ category: 'ux_issue', step: '10-select-text', detail: 'Text inline edit panel does NOT appear when text layer is selected — user cannot edit text without re-adding it', screenshot: sc })
    }

    // Verify clicking image layer does NOT show text as selected
    if (imgCount > 0) {
      await imageLayers.first().click({ force: true })
      await page.waitForTimeout(300)
      const selTextAfter = page.locator('.placement-canvas-text-target.placement-canvas-art--selected')
      if (await selTextAfter.isVisible().catch(() => false)) {
        record({ category: 'broken', step: '10-select-text', detail: 'Text layer still shows as selected after clicking image layer — selection not switching correctly' })
      } else {
        record({ category: 'works', step: '10-select-text', detail: 'Clicking image layer deselects text layer correctly' })
      }
    }

    for (const e of getErrors()) record({ category: 'console_error', step: '10-select-text', detail: e.substring(0, 300) })
  })

  // ── 11: Preview button ─────────────────────────────────────────────────────
  test('11 - Preview button (generate mockup)', async () => {
    if (!_authReady || !sharedPage || !_draftUrl) {
      record({ category: 'broken', step: '11-preview', detail: 'No draft URL — skipping' })
      return
    }
    const page = sharedPage
    const getErrors = listenConsole(page)

    const previewBtn = page.locator('.preview-canvas-header-preview-btn')
    if (!(await previewBtn.isVisible().catch(() => false))) {
      const sc = await shot(page, '11-no-preview-btn')
      record({ category: 'broken', step: '11-preview', detail: '"Preview →" button not visible in canvas header', screenshot: sc })
      return
    }

    const disabled = await previewBtn.isDisabled().catch(() => false)
    if (disabled) {
      // Wait for auto-save to complete pattern_image_url
      record({ category: 'ux_issue', step: '11-preview', detail: '"Preview →" still disabled after upload + 4s wait — hasPatternImage may be false until auto-save completes (takes ~2s)' })
      await page.waitForTimeout(4000)
      const stillDisabled = await previewBtn.isDisabled().catch(() => false)
      if (stillDisabled) {
        record({ category: 'broken', step: '11-preview', detail: '"Preview →" disabled even after 8s wait — pattern may not have been saved to draft.pattern_image_url' })
        return
      }
    }

    record({ category: 'works', step: '11-preview', detail: '"Preview →" button enabled' })
    await previewBtn.click()
    const sc1 = await shot(page, '11-after-click')

    await page.waitForTimeout(2000)

    const spinner = page.locator('.preview-reference-loading')
    const mockupsSection = page.locator('.preview-mockups-section')

    if (await mockupsSection.isVisible().catch(() => false)) {
      record({ category: 'works', step: '11-preview', detail: 'Mockup preview view shown (cached mockups)', screenshot: await shot(page, '11-mockups') })

      const backBtn = page.locator('.preview-canvas-header-back-btn')
      if (await backBtn.isVisible().catch(() => false)) {
        record({ category: 'works', step: '11-preview', detail: '"← Edit template" back button visible in mockup view' })
      } else {
        record({ category: 'ux_issue', step: '11-preview', detail: '"← Edit template" back button NOT visible — no way back to canvas from mockup view' })
      }
    } else if (await spinner.isVisible().catch(() => false)) {
      record({ category: 'works', step: '11-preview', detail: 'Mockup generation started — loading indicator shown', screenshot: sc1 })
      await page.waitForTimeout(25000)
      if (await mockupsSection.isVisible().catch(() => false)) {
        record({ category: 'works', step: '11-preview', detail: 'Mockup generation completed', screenshot: await shot(page, '11-mockups-generated') })
      } else {
        const catalogNote = page.locator('.preview-reference-catalog-note')
        if (await catalogNote.isVisible().catch(() => false)) {
          record({ category: 'ux_issue', step: '11-preview', detail: 'Preview fell back to catalog photos — Printful mockup API returned no mockup URLs for this product', screenshot: await shot(page, '11-catalog-fallback') })
        } else {
          record({ category: 'broken', step: '11-preview', detail: 'Preview generation timed out after 25s — Printful API may be unreachable or slow', screenshot: await shot(page, '11-timeout') })
        }
      }
    } else {
      record({ category: 'broken', step: '11-preview', detail: '"Preview →" click did not trigger generation or show mockups', screenshot: sc1 })
    }

    for (const e of getErrors()) record({ category: 'console_error', step: '11-preview', detail: e.substring(0, 300) })
  })

  // ── 12: Finish / Publish button ────────────────────────────────────────────
  test('12 - Finish (publish) button', async () => {
    if (!_authReady || !sharedPage || !_draftUrl) {
      record({ category: 'broken', step: '12-finish', detail: 'No draft URL — skipping' })
      return
    }
    const page = sharedPage
    const getErrors = listenConsole(page)

    // Go back to canvas view if in mockup view
    const editTemplateBtn = page.locator('.preview-canvas-header-back-btn')
    if (await editTemplateBtn.isVisible().catch(() => false)) {
      await editTemplateBtn.click()
      await page.waitForTimeout(400)
    }

    const sc = await shot(page, '12-finish-step')

    const finishBtn = page.locator('button.design-tool-step-bar-action').filter({ hasText: /finish/i }).first()
    if (await finishBtn.isVisible().catch(() => false)) {
      record({ category: 'works', step: '12-finish', detail: '"Finish →" publish button visible in step bar on Customize step', screenshot: sc })
      await finishBtn.click()
      await page.waitForTimeout(800)

      const modal = page.locator('.publish-flow-modal, [role="dialog"]').first()
      if (await modal.isVisible().catch(() => false)) {
        record({ category: 'works', step: '12-finish', detail: 'Publish flow modal opens on "Finish →" click', screenshot: await shot(page, '12-publish-modal') })
      } else {
        record({ category: 'broken', step: '12-finish', detail: '"Finish →" clicked but publish modal did not open', screenshot: await shot(page, '12-no-modal') })
      }

      // Close modal
      const closeModal = page.locator('button[aria-label="Close"], button').filter({ hasText: /×|close/i }).first()
      if (await closeModal.isVisible().catch(() => false)) {
        await closeModal.click()
        await page.waitForTimeout(300)
      } else {
        await page.keyboard.press('Escape')
      }
    } else {
      record({ category: 'ux_issue', step: '12-finish', detail: '"Finish →" button NOT visible on Customize step — publish path is hidden from users. Button only renders when editorStep===customize in step bar.', screenshot: sc })

      // Count visible publish step label
      const publishLabel = page.locator('.design-tool-step').filter({ hasText: /publish/i }).first()
      if (await publishLabel.isVisible().catch(() => false)) {
        record({ category: 'ux_issue', step: '12-finish', detail: '"Publish" step label visible in bar but is not clickable — only "Finish →" action button leads to publish' })
      }
    }

    for (const e of getErrors()) record({ category: 'console_error', step: '12-finish', detail: e.substring(0, 300) })
  })

  // ── 13: UI & accessibility audit ───────────────────────────────────────────
  test('13 - UI & accessibility audit', async () => {
    if (!_authReady || !sharedPage || !_draftUrl) {
      record({ category: 'broken', step: '13-ui-audit', detail: 'No draft URL — skipping' })
      return
    }
    const page = sharedPage
    const getErrors = listenConsole(page)
    const sc = await shot(page, '13-ui-audit')

    // Unlabelled buttons
    const visBtns = page.locator('button:visible')
    const btnCount = await visBtns.count()
    let unlabelled = 0
    for (let i = 0; i < Math.min(btnCount, 60); i++) {
      const btn = visBtns.nth(i)
      const txt = (await btn.textContent())?.trim()
      const aria = await btn.getAttribute('aria-label')
      const ariaBy = await btn.getAttribute('aria-labelledby')
      if ((!txt || txt.length === 0) && !aria && !ariaBy) unlabelled++
    }
    if (unlabelled > 0) {
      record({ category: 'ux_issue', step: '13-ui-audit', detail: `${unlabelled} visible button(s) have no text AND no aria-label — inaccessible to screen readers`, screenshot: sc })
    } else {
      record({ category: 'works', step: '13-ui-audit', detail: 'All checked visible buttons have accessible names (text or aria-label)' })
    }

    // Images without alt
    const noAlt = await page.locator('img:not([alt])').count()
    if (noAlt > 0) {
      record({ category: 'ux_issue', step: '13-ui-audit', detail: `${noAlt} <img> element(s) missing alt attribute — inaccessible to screen readers` })
    } else {
      record({ category: 'works', step: '13-ui-audit', detail: 'All <img> elements have alt attributes' })
    }

    // MediaUploaderUI placeholder
    const mediaUploader = page.locator('.media-uploader')
    if (await mediaUploader.isVisible().catch(() => false)) {
      record({ category: 'broken', step: '13-ui-audit', detail: 'MediaUploaderUI placeholder is visible in the active design flow — upload button does NOTHING (handleClick and handleDrop are no-ops). See components/design-tool/MediaUploaderUI.tsx lines 29-34.', screenshot: sc })
    } else {
      record({ category: 'works', step: '13-ui-audit', detail: 'MediaUploaderUI placeholder is NOT in use — PreviewWorkspace correctly handles uploads' })
    }

    // Auto-save indicator
    await page.waitForTimeout(3500)
    const autosave = page.locator('.design-tool-autosave')
    if (await autosave.isVisible().catch(() => false)) {
      record({ category: 'works', step: '13-ui-audit', detail: `Auto-save indicator: "${await autosave.textContent()}"` })
    } else {
      record({ category: 'ux_issue', step: '13-ui-audit', detail: 'Auto-save indicator idle — check if it shows after changes (no error state exists if save fails)' })
    }

    // Back link
    const changeShoe = page.locator('.design-tool-back-link')
    if (await changeShoe.isVisible().catch(() => false)) {
      record({ category: 'works', step: '13-ui-audit', detail: '"← Change shoe" navigation visible in step bar' })
    } else {
      record({ category: 'ux_issue', step: '13-ui-audit', detail: '"← Change shoe" link not visible — no clear way to restart model selection' })
    }

    for (const e of getErrors()) record({ category: 'console_error', step: '13-ui-audit', detail: e.substring(0, 300) })
  })

  // ── 14: Mobile viewport ────────────────────────────────────────────────────
  test('14 - Mobile viewport (iPhone 375x812)', async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 375, height: 812 } })
    const page = await ctx.newPage()
    const getErrors = listenConsole(page)

    try {
      // Homepage on mobile
      await page.goto(BASE_URL, { waitUntil: 'networkidle' })
      const sc1 = await shot(page, '14-mobile-homepage')
      record({ category: 'works', step: '14-mobile', detail: 'Homepage loads on 375x812 viewport', screenshot: sc1 })

      // Cookie consent banner visibility
      const cookieBanner = page.locator('.cookie-banner, [data-testid="cookie-banner"], .cookie-consent').first()
      if (await cookieBanner.isVisible({ timeout: 2000 }).catch(() => false)) {
        record({ category: 'ux_issue', step: '14-mobile', detail: 'Cookie consent banner appears on mobile — may block auth modal interactions if z-index is lower than modal overlay', screenshot: sc1 })
        // Try to accept it
        const acceptBtn = page.locator('button').filter({ hasText: /accept all|accept/i }).first()
        if (await acceptBtn.isVisible().catch(() => false)) {
          await acceptBtn.click()
          await page.waitForTimeout(300)
        }
      }

      // Navbar on mobile
      const nav = page.locator('nav.navbar, nav').first()
      if (await nav.isVisible().catch(() => false)) {
        const navBox = await nav.boundingBox()
        record({ category: 'works', step: '14-mobile', detail: `Navbar visible (height: ${navBox?.height?.toFixed(0)}px)` })
      }

      // Login on mobile
      const mobileAuth = await loginViaModal(page)
      if (mobileAuth) {
        record({ category: 'works', step: '14-mobile', detail: 'Auth modal works on mobile viewport — login succeeded' })
      } else {
        record({ category: 'broken', step: '14-mobile', detail: 'Auth modal login failed on mobile viewport' })
      }

      // Design tool hub
      await page.goto(`${BASE_URL}/design-tool`, { waitUntil: 'networkidle' })
      await page.waitForTimeout(1000)
      const sc2 = await shot(page, '14-mobile-design-hub')

      const hubCards = page.locator('.dt-hub-option-card')
      if ((await hubCards.count()) > 0) {
        record({ category: 'works', step: '14-mobile', detail: 'Design hub option cards visible on mobile', screenshot: sc2 })
        // Check cards fit viewport
        const firstCard = await hubCards.first().boundingBox()
        if (firstCard && firstCard.width > 375) {
          record({ category: 'ux_issue', step: '14-mobile', detail: `Hub card overflows viewport: ${Math.round(firstCard.width)}px > 375px` })
        }
      } else {
        record({ category: 'broken', step: '14-mobile', detail: 'Hub option cards not visible on mobile', screenshot: sc2 })
      }

      if (_draftUrl) {
        await page.goto(_draftUrl, { waitUntil: 'domcontentloaded' })
        await page.waitForTimeout(2000)
        const sc3 = await shot(page, '14-mobile-editor')

        // Step bar overflow
        const stepBar = page.locator('.design-tool-step-bar')
        if (await stepBar.isVisible().catch(() => false)) {
          const sbBox = await stepBar.boundingBox()
          if (sbBox) {
            if (sbBox.width > 380) {
              record({ category: 'ux_issue', step: '14-mobile', detail: `Step bar ${Math.round(sbBox.width)}px wide on 375px screen — may cause overflow/wrapping`, screenshot: sc3 })
            } else {
              record({ category: 'works', step: '14-mobile', detail: `Step bar fits mobile viewport (${Math.round(sbBox.width)}px)` })
            }
          }
        }

        // Switch to customize
        const custBtn = page.locator('button.design-tool-step--btn').filter({ hasText: /customize/i }).first()
        if (await custBtn.isVisible().catch(() => false)) {
          await custBtn.click()
          await page.waitForTimeout(800)
        }
        const sc4 = await shot(page, '14-mobile-customize')

        // Mobile toggle
        const toggle = page.locator('.design-customize-tools-toggle')
        if (await toggle.isVisible().catch(() => false)) {
          record({ category: 'works', step: '14-mobile', detail: '"▼ Adjust positions" mobile toggle visible', screenshot: sc4 })
          await toggle.click()
          await page.waitForTimeout(300)
          const panel = page.locator('.design-customize-tools-panel')
          if (await panel.isVisible().catch(() => false)) {
            record({ category: 'works', step: '14-mobile', detail: 'Mobile adjustment panel opens on toggle', screenshot: await shot(page, '14-mobile-tools-open') })
          } else {
            record({ category: 'broken', step: '14-mobile', detail: 'Mobile tools panel did not open after clicking toggle' })
          }
        } else {
          const aiPanel = page.locator('.ai-prompt-panel')
          if (await aiPanel.isVisible().catch(() => false)) {
            record({ category: 'works', step: '14-mobile', detail: 'On Design step (chat) — no adjustment toggle needed', screenshot: sc4 })
          } else {
            record({ category: 'ux_issue', step: '14-mobile', detail: 'Mobile adjustment toggle not present and not on design step — position controls may be inaccessible on mobile', screenshot: sc4 })
          }
        }

        // Canvas overflow check
        const canvas = page.locator('.preview-workspace')
        if (await canvas.isVisible().catch(() => false)) {
          const cBox = await canvas.boundingBox()
          if (cBox && cBox.width > 380) {
            record({ category: 'ux_issue', step: '14-mobile', detail: `Preview workspace ${Math.round(cBox.width)}px wide on 375px screen`, screenshot: sc4 })
          } else if (cBox) {
            record({ category: 'works', step: '14-mobile', detail: `Preview workspace fits mobile (${Math.round(cBox.width)}px)` })
          }
        }
      }
    } finally {
      await ctx.close().catch(() => {})
    }

    for (const e of getErrors()) record({ category: 'console_error', step: '14-mobile', detail: e.substring(0, 300) })
  })
})
