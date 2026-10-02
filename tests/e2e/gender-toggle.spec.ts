import { test, expect } from '@playwright/test'

/**
 * Gender toggle tests for product page (Phase 3 of mens/womens unification).
 *
 * Test product: id=99 "Flower Forest" — High Top Canvas Shoes
 *   - 17 Men's variants (sizes 5–13, including 12.5 and 13)
 *   - 15 Women's variants (sizes 5–12, no 12.5 or 13)
 *   - Both mens and womens mockups generated
 */
const PRODUCT_URL = '/item/99'

test.describe('Gender toggle — product page', () => {
  test('toggle renders with Men\'s active by default', async ({ page }) => {
    await page.goto(PRODUCT_URL)
    await page.waitForSelector('.product-gender-toggle', { timeout: 15_000 })

    const toggle = page.locator('.product-gender-toggle')
    await expect(toggle).toBeVisible()

    // Use nth() to avoid hasText: "Men's" matching "Women's" (substring)
    const mensBtn = toggle.locator('.product-gender-btn').nth(0)
    const womensBtn = toggle.locator('.product-gender-btn').nth(1)
    await expect(mensBtn).toBeVisible()
    await expect(womensBtn).toBeVisible()
    await expect(mensBtn).toContainText("Men's")
    await expect(womensBtn).toContainText("Women's")

    // Men's should be active by default
    await expect(mensBtn).toHaveClass(/active/)
    await expect(womensBtn).not.toHaveClass(/active/)

    await page.screenshot({ path: 'tests/e2e/gender-toggle-default.png' })
    console.log('[gender-toggle] Default state: Men\'s active ✓')
  })

  test('Men\'s sizing note shown by default', async ({ page }) => {
    await page.goto(PRODUCT_URL)
    await page.waitForSelector('.product-attribute-gender-note', { timeout: 15_000 })

    const note = page.locator('.product-attribute-gender-note')
    await expect(note).toContainText("Men")
    console.log('[gender-toggle] Men\'s sizing note visible ✓')
  })

  test('Men\'s sizes include 12.5 and 13 (men-only sizes)', async ({ page }) => {
    await page.goto(PRODUCT_URL)
    await page.waitForSelector('.product-attribute-options', { timeout: 15_000 })

    const options = page.locator('.product-attribute-option')
    const labels = await options.allTextContents()
    console.log('[gender-toggle] Men\'s size labels:', labels)

    const hasTwelvePointFive = labels.some((l) => l.trim() === '12.5')
    const hasThirteen = labels.some((l) => l.trim() === '13')
    expect(hasTwelvePointFive).toBe(true)
    expect(hasThirteen).toBe(true)
    console.log('[gender-toggle] Men\'s-only sizes 12.5 and 13 present ✓')
  })

  test('switching to Women\'s activates the button and updates sizing note', async ({ page }) => {
    await page.goto(PRODUCT_URL)
    await page.waitForSelector('.product-gender-toggle', { timeout: 15_000 })

    const toggle = page.locator('.product-gender-toggle')
    const mensBtn = toggle.locator('.product-gender-btn').nth(0)
    const womensBtn = toggle.locator('.product-gender-btn').nth(1)

    await womensBtn.click()

    await expect(womensBtn).toHaveClass(/active/)
    await expect(mensBtn).not.toHaveClass(/active/)

    // Sizing note should update
    const note = page.locator('.product-attribute-gender-note')
    await expect(note).toContainText("Women")

    await page.screenshot({ path: 'tests/e2e/gender-toggle-womens.png' })
    console.log('[gender-toggle] Women\'s active after click ✓')
  })

  test('Women\'s sizes do NOT include 12.5 or 13', async ({ page }) => {
    await page.goto(PRODUCT_URL)
    await page.waitForSelector('.product-gender-toggle', { timeout: 15_000 })

    const womensBtn = page.locator('.product-gender-toggle .product-gender-btn', { hasText: "Women's" })
    await womensBtn.click()

    // Wait for size options to update
    await page.waitForTimeout(300)

    const options = page.locator('.product-attribute-option')
    const labels = await options.allTextContents()
    console.log('[gender-toggle] Women\'s size labels:', labels)

    const hasTwelvePointFive = labels.some((l) => l.trim() === '12.5')
    const hasThirteen = labels.some((l) => l.trim() === '13')
    expect(hasTwelvePointFive).toBe(false)
    expect(hasThirteen).toBe(false)
    console.log('[gender-toggle] Men\'s-only sizes 12.5 and 13 absent for Women\'s ✓')
  })

  test('switching gender clears selected size', async ({ page }) => {
    await page.goto(PRODUCT_URL)
    await page.waitForSelector('.product-attribute-options', { timeout: 15_000 })

    // Select a size that exists for both genders (e.g. 8)
    const sizeEight = page.locator('.product-attribute-option', { hasText: /^8$/ }).first()
    await sizeEight.click()
    await expect(sizeEight).toHaveClass(/selected/)

    // Switch to Women's
    const womensBtn = page.locator('.product-gender-toggle .product-gender-btn', { hasText: "Women's" })
    await womensBtn.click()
    await page.waitForTimeout(300)

    // No size should be selected anymore
    const selectedOptions = page.locator('.product-attribute-option.selected')
    const selectedCount = await selectedOptions.count()
    expect(selectedCount).toBe(0)
    console.log('[gender-toggle] Size selection cleared on gender switch ✓')
  })

  test('switching gender fires mockup API request with correct gender param', async ({ page }) => {
    const mockupRequests: string[] = []
    page.on('request', (req) => {
      if (req.url().includes('/api/products/') && req.url().includes('/mockups')) {
        mockupRequests.push(req.url())
      }
    })

    await page.goto(PRODUCT_URL)
    await page.waitForSelector('.product-gender-toggle', { timeout: 15_000 })
    // Wait for initial mens mockup fetch to settle
    await page.waitForLoadState('networkidle')
    mockupRequests.length = 0 // clear initial load requests

    const womensBtn = page.locator('.product-gender-toggle .product-gender-btn', { hasText: "Women's" })
    await womensBtn.click()
    await page.waitForLoadState('networkidle')

    console.log('[gender-toggle] Mockup requests after Women\'s click:', mockupRequests)
    const womensRequest = mockupRequests.find((url) => url.includes('gender=womens'))
    expect(womensRequest).toBeTruthy()
    console.log('[gender-toggle] Mockup API called with gender=womens ✓')
  })

  test('gallery image changes after switching to Women\'s', async ({ page }) => {
    await page.goto(PRODUCT_URL)
    await page.waitForSelector('.product-main-image', { timeout: 15_000 })
    await page.waitForLoadState('networkidle')

    const mainImage = page.locator('.product-main-image')
    const mensSrc = await mainImage.getAttribute('src')
    console.log('[gender-toggle] Initial (mens) image src:', mensSrc?.slice(0, 80))

    const womensBtn = page.locator('.product-gender-toggle .product-gender-btn').nth(1)
    await womensBtn.click()

    // Wait for React to re-render with new image (networkidle alone doesn't guarantee DOM update)
    await page.waitForFunction(
      (src) => {
        const img = document.querySelector('.product-main-image') as HTMLImageElement | null
        return img != null && img.src !== src
      },
      mensSrc,
      { timeout: 10_000 }
    )

    const womensSrc = await mainImage.getAttribute('src')
    console.log('[gender-toggle] Women\'s image src:', womensSrc?.slice(0, 80))

    expect(womensSrc).not.toBe(mensSrc)
    console.log('[gender-toggle] Gallery updated to womens images ✓')
  })

  test('gallery resets to first image when switching gender', async ({ page }) => {
    await page.goto(PRODUCT_URL)
    await page.waitForSelector('.product-thumbnails', { timeout: 15_000 })

    // Click second thumbnail to advance gallery
    const thumbs = page.locator('.product-thumbnail')
    const thumbCount = await thumbs.count()
    if (thumbCount >= 2) {
      await thumbs.nth(1).click()
      await expect(thumbs.nth(1)).toHaveClass(/active/)
      console.log('[gender-toggle] Navigated to thumbnail 2')
    }

    // Switch gender — should reset to first image
    const womensBtn = page.locator('.product-gender-toggle .product-gender-btn', { hasText: "Women's" })
    await womensBtn.click()
    await page.waitForLoadState('networkidle')

    const firstThumb = thumbs.nth(0)
    await expect(firstThumb).toHaveClass(/active/)
    console.log('[gender-toggle] Gallery reset to first image on gender switch ✓')
  })

  test('old product (no gender variants) does NOT show the toggle', async ({ page }) => {
    // Product 97 "Space Cats" was published before the gender variant flow
    await page.goto('/item/97')
    await page.waitForSelector('.product-details', { timeout: 15_000 })

    const toggle = page.locator('.product-gender-toggle')
    await expect(toggle).not.toBeVisible()
    console.log('[gender-toggle] Pre-unification product has no gender toggle ✓')
  })
})
