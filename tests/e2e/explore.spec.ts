import { test, expect } from '@playwright/test'

test('homepage', async ({ page }) => {
  await page.goto('/')
  await page.waitForLoadState('networkidle')
  console.log('TITLE:', await page.title())
  console.log('URL:', page.url())
  // Check for console errors
  page.on('console', msg => { if (msg.type() === 'error') console.log('CONSOLE ERROR:', msg.text()) })
  const bodyText = await page.locator('body').innerText()
  console.log('BODY SNIPPET:', bodyText.slice(0, 500))
})

test('marketplace', async ({ page }) => {
  const errors: string[] = []
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()) })
  await page.goto('/marketplace')
  await page.waitForLoadState('networkidle')
  console.log('ERRORS:', errors)
  const products = await page.locator('a[href*="/item/"]').all()
  console.log('PRODUCT COUNT:', products.length)
  for (const p of products.slice(0, 3)) {
    console.log('PRODUCT:', await p.innerText().then(t => t.slice(0, 80).replace(/\n/g, ' ')))
  }
})

test('product page', async ({ page }) => {
  const errors: string[] = []
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()) })
  await page.goto('/marketplace')
  await page.waitForLoadState('networkidle')
  const firstProduct = page.locator('a[href*="/item/"]').first()
  const href = await firstProduct.getAttribute('href')
  console.log('NAVIGATING TO:', href)
  await page.goto(href!)
  await page.waitForLoadState('networkidle')
  console.log('CONSOLE ERRORS:', errors)
  console.log('URL:', page.url())
  const bodyText = await page.locator('body').innerText()
  console.log('BODY:', bodyText.slice(0, 800).replace(/\n+/g, ' | '))
})

test('add to cart flow', async ({ page }) => {
  const errors: string[] = []
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()) })
  await page.goto('/marketplace')
  await page.waitForLoadState('networkidle')
  const firstProduct = page.locator('a[href*="/item/"]').first()
  await page.goto((await firstProduct.getAttribute('href'))!)
  await page.waitForLoadState('networkidle')

  // Try to find add to cart button
  const addToCart = page.locator('button').filter({ hasText: /add to cart/i }).first()
  const visible = await addToCart.isVisible().catch(() => false)
  console.log('ADD TO CART VISIBLE:', visible)
  if (visible) {
    // Pick a size first if needed
    const sizeBtn = page.locator('button[class*="size"], button[class*="attribute"]').first()
    if (await sizeBtn.isVisible().catch(() => false)) {
      await sizeBtn.click()
      console.log('SELECTED SIZE')
    }
    await addToCart.click()
    await page.waitForTimeout(1500)
    console.log('AFTER ADD TO CART - URL:', page.url())
    const cartBadge = page.locator('[class*="cart-badge"], [class*="cart-count"]').first()
    console.log('CART BADGE VISIBLE:', await cartBadge.isVisible().catch(() => false))
  }
  console.log('ERRORS:', errors)
})

test('pricing / become creator page', async ({ page }) => {
  const errors: string[] = []
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()) })
  await page.goto('/pricing')
  await page.waitForLoadState('networkidle')
  console.log('PRICING URL:', page.url())
  const bodyText = await page.locator('body').innerText()
  console.log('PRICING BODY:', bodyText.slice(0, 600).replace(/\n+/g, ' | '))
  console.log('ERRORS:', errors)
})

test('design tool entry', async ({ page }) => {
  const errors: string[] = []
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()) })
  await page.goto('/design-tool')
  await page.waitForLoadState('networkidle')
  console.log('DESIGN TOOL URL:', page.url())
  const bodyText = await page.locator('body').innerText()
  console.log('BODY:', bodyText.slice(0, 400).replace(/\n+/g, ' | '))
  console.log('ERRORS:', errors)
})

test('profile page', async ({ page }) => {
  const errors: string[] = []
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()) })
  await page.goto('/profile')
  await page.waitForLoadState('networkidle')
  console.log('PROFILE URL:', page.url())
  const bodyText = await page.locator('body').innerText()
  console.log('BODY:', bodyText.slice(0, 400).replace(/\n+/g, ' | '))
  console.log('ERRORS:', errors)
})

test('404 page', async ({ page }) => {
  await page.goto('/this-page-does-not-exist')
  await page.waitForLoadState('networkidle')
  console.log('404 URL:', page.url())
  const bodyText = await page.locator('body').innerText()
  console.log('404 BODY:', bodyText.slice(0, 200))
})
