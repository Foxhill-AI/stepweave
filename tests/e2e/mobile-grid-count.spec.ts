import { test, expect } from '@playwright/test'

test('homepage mobile grid item count', async ({ page }) => {
  // 1. Open at 375px wide mobile viewport
  await page.setViewportSize({ width: 375, height: 812 })
  await page.goto('https://www.stepweave.com')

  // 2. Wait for .content-section-grid to appear
  await page.waitForSelector('.content-section-grid', { timeout: 20_000 })

  // 3. Count visible .content-section-grid-item elements in the first grid
  const firstGrid = page.locator('.content-section-grid').first()
  const items = firstGrid.locator('.content-section-grid-item')
  const count = await items.count()

  // 4. Log the count
  console.log(`[mobile-grid-count] First .content-section-grid item count: ${count}`)

  // 5. Check if page HTML contains "HOME_SECTION_GRID_INITIAL"
  const html = await page.content()
  const containsConfigKey = html.includes('HOME_SECTION_GRID_INITIAL')
  console.log(`[mobile-grid-count] Page HTML contains "HOME_SECTION_GRID_INITIAL": ${containsConfigKey}`)

  // 6. Grab full outer HTML of the first .content-section-grid
  const gridOuterHtml = await firstGrid.evaluate((el) => el.outerHTML)
  console.log('[mobile-grid-count] First .content-section-grid outerHTML (truncated to 2000 chars):')
  console.log(gridOuterHtml.slice(0, 2000))

  // 7. Check for hardcoded initialVisibleCount in page source
  const containsInitialVisibleCount = html.includes('initialVisibleCount')
  console.log(`[mobile-grid-count] Page source contains "initialVisibleCount": ${containsInitialVisibleCount}`)

  // Also log all numeric values near "initialVisibleCount" if present
  const matches = [...html.matchAll(/initialVisibleCount[^0-9]*(\d+)/g)]
  if (matches.length > 0) {
    matches.forEach((m) => {
      console.log(`[mobile-grid-count] initialVisibleCount value found in source: ${m[1]}`)
    })
  }

  // 8. Take a screenshot
  await page.screenshot({ path: 'tests/e2e/mobile-grid-count.png', fullPage: false })
  console.log('[mobile-grid-count] Screenshot saved to tests/e2e/mobile-grid-count.png')

  // Assertion: expect 4 items based on config (will fail if override is 3)
  expect(count).toBe(4)
})
