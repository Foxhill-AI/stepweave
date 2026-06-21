import { test, expect, Page } from '@playwright/test'

const TEST_EMAIL = 'playwright-test@stepweave.test'
const TEST_PASSWORD = 'PlaywrightTest123!'

async function login(page: Page) {
  await page.goto('/?openAuth=1')
  await page.waitForTimeout(1500)

  // Find email/password fields in the modal
  const emailField = page.locator('input[type="email"]').first()
  const passwordField = page.locator('input[type="password"]').first()

  await expect(emailField).toBeVisible({ timeout: 8000 })
  await emailField.fill(TEST_EMAIL)
  await passwordField.fill(TEST_PASSWORD)

  // Submit
  const submitBtn = page.locator('button[type="submit"]').first()
  await submitBtn.click()
  await page.waitForTimeout(2000)
  console.log('LOGIN URL:', page.url())
}

const SUPABASE_URL = 'https://ticbffbhohsofmarvdni.supabase.co'
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
const TEST_CART_ID = 7 // cart for playwright-test user (account id 44)

async function clearTestCart() {
  if (!SUPABASE_SERVICE_KEY) return
  await fetch(`${SUPABASE_URL}/rest/v1/cart_item?cart_id=eq.${TEST_CART_ID}`, {
    method: 'DELETE',
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
    },
  })
}

test('full purchase flow', async ({ page }) => {
  test.setTimeout(90_000)
  const errors: string[] = []
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()) })

  await clearTestCart()

  // ── 1. Log in ──────────────────────────────────────────────────────────────
  console.log('\n── STEP 1: Login ──')
  await login(page)

  // Check we're logged in (no "Log in" button visible, or user menu visible)
  const loggedIn = await page.locator('text=Log in').isVisible().then(v => !v).catch(() => false)
  console.log('LOGGED IN:', loggedIn)

  // ── 2. Navigate to marketplace and pick a product ──────────────────────────
  console.log('\n── STEP 2: Marketplace ──')
  await page.goto('/marketplace')
  await page.waitForLoadState('networkidle')

  const products = page.locator('a[href*="/item/"]')
  const count = await products.count()
  console.log('PRODUCTS VISIBLE:', count)
  expect(count).toBeGreaterThan(0)

  const firstHref = await products.first().getAttribute('href')
  console.log('GOING TO PRODUCT:', firstHref)
  await page.goto(firstHref!)
  await page.waitForLoadState('networkidle')

  // ── 3. Select size and add to cart ─────────────────────────────────────────
  console.log('\n── STEP 3: Product page ──')
  console.log('PRODUCT URL:', page.url())

  // Check for size/attribute buttons
  const sizeButtons = page.locator('button[class*="attribute"], button[class*="option"], .product-attribute-option-btn')
  const sizeCount = await sizeButtons.count()
  console.log('SIZE BUTTONS:', sizeCount)

  if (sizeCount > 0) {
    await sizeButtons.first().click()
    console.log('SELECTED FIRST SIZE')
    await page.waitForTimeout(300)
  }

  const addToCartBtn = page.locator('button').filter({ hasText: /add to cart/i })
  await expect(addToCartBtn).toBeVisible({ timeout: 5000 })
  await addToCartBtn.click()
  await page.waitForTimeout(1500)

  const pageError = await page.locator('.product-page-error').isVisible().catch(() => false)
  const errorText = pageError ? await page.locator('.product-page-error').innerText() : null
  console.log('ADD TO CART ERROR:', errorText)
  expect(errorText).toBeNull()

  // Cart badge should now show
  const cartBadge = page.locator('.cart-badge')
  const badgeVisible = await cartBadge.isVisible().catch(() => false)
  const badgeText = badgeVisible ? await cartBadge.innerText() : null
  console.log('CART BADGE:', badgeText)

  // ── 4. Go to cart ──────────────────────────────────────────────────────────
  console.log('\n── STEP 4: Cart ──')
  await page.goto('/cart')
  await page.waitForLoadState('networkidle')
  console.log('CART URL:', page.url())

  const cartBody = await page.locator('body').innerText()
  console.log('CART CONTENT:', cartBody.slice(0, 400).replace(/\n+/g, ' | '))

  const checkoutBtn = page.locator('button').filter({ hasText: /proceed to checkout/i })
  await expect(checkoutBtn).toBeVisible({ timeout: 5000 })

  // ── 5. Proceed to Stripe checkout ──────────────────────────────────────────
  console.log('\n── STEP 5: Checkout ──')
  await checkoutBtn.click()
  await page.waitForURL(/stripe\.com|checkout\.stripe\.com/, { timeout: 15000 })
  console.log('STRIPE URL:', page.url())
  expect(page.url()).toContain('stripe.com')

  // ── 6. Fill Stripe test checkout form ──────────────────────────────────────
  console.log('\n── STEP 6: Stripe form ──')
  // Stripe keeps polling so never reaches networkidle — just wait for the email field
  const stripeEmail = page.locator('input[placeholder*="email" i]').first()
  await expect(stripeEmail).toBeVisible({ timeout: 15000 })

  await stripeEmail.fill('playwright-test@stepweave.test')
  console.log('FILLED EMAIL')

  // Full name (shipping)
  const fullName = page.locator('input[placeholder="Full name"]').first()
  await expect(fullName).toBeVisible({ timeout: 5000 })
  await fullName.fill('Test User')
  console.log('FILLED NAME')

  // Address autocomplete — click "Enter address manually" to avoid it
  const manualLink = page.locator('text=Enter address manually')
  if (await manualLink.isVisible({ timeout: 3000 }).catch(() => false)) {
    await manualLink.click()
    console.log('SWITCHED TO MANUAL ADDRESS')
    await page.waitForTimeout(500)
  }

  const addressInput = page.locator('input[placeholder="Address line 1"], input[placeholder="Address"]').first()
  if (await addressInput.isVisible({ timeout: 3000 }).catch(() => false)) {
    await addressInput.fill('123 Test Street')
  }
  const cityInput = page.locator('input[placeholder="City"]').first()
  if (await cityInput.isVisible({ timeout: 3000 }).catch(() => false)) {
    await cityInput.fill('New York')
  }
  const zipInput = page.locator('input[placeholder="ZIP"]').first()
  if (await zipInput.isVisible({ timeout: 2000 }).catch(() => false)) {
    await zipInput.fill('10001')
  }
  console.log('FILLED SHIPPING ADDRESS')

  // Select "Card" payment method via its radio button
  const cardRadio = page.locator('[data-testid="card-accordion-item-button"], input[value="card"]').first()
  if (await cardRadio.isVisible({ timeout: 5000 }).catch(() => false)) {
    await cardRadio.click({ force: true })
    console.log('SELECTED CARD')
    await page.waitForTimeout(1000)
  }

  // Scroll down so card fields are in view
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
  await page.waitForTimeout(1500)

  // (navPromise set up after form fill, before clicking Pay)

  // Stripe's unified card element renders directly in the page (not in iframes)
  const cardNumEl = page.locator('input[placeholder="1234 1234 1234 1234"]')
  if (await cardNumEl.isVisible({ timeout: 5000 }).catch(() => false)) {
    await cardNumEl.click()
    await page.keyboard.type('4242424242424242', { delay: 50 })
    console.log('FILLED CARD NUMBER (direct)')
  }

  const expiryEl = page.locator('input[placeholder="MM / YY"]')
  if (await expiryEl.isVisible({ timeout: 3000 }).catch(() => false)) {
    await expiryEl.click()
    await page.keyboard.type('1230', { delay: 50 })
    console.log('FILLED EXPIRY (direct)')
  }

  const cvcEl = page.locator('input[placeholder="CVC"]')
  if (await cvcEl.isVisible({ timeout: 3000 }).catch(() => false)) {
    await cvcEl.click()
    await page.keyboard.type('123', { delay: 50 })
    console.log('FILLED CVC (direct)')
  }

  // ── 7. Submit Stripe payment ────────────────────────────────────────────────
  console.log('\n── STEP 7: Submit payment ──')

  // Fill phone number (required by Stripe Link "Save my information")
  const phoneInput = page.locator('input[placeholder="(201) 555-0123"], input[type="tel"]').first()
  if (await phoneInput.isVisible({ timeout: 2000 }).catch(() => false)) {
    await phoneInput.click()
    await phoneInput.fill('2125551234')
    console.log('FILLED PHONE NUMBER')
    await page.waitForTimeout(500)
  }

  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
  await page.waitForTimeout(500)

  const payBtn = page.getByTestId('hosted-payment-submit-button')
  await expect(payBtn).toBeVisible({ timeout: 10000 })
  console.log('PAY BUTTON FOUND')

  const navPromise = page.waitForURL(/stepweave\.com/, { timeout: 60000 })
  await payBtn.click()
  await navPromise

  console.log('FINAL URL:', page.url())
  const finalBody = await page.locator('body').innerText()
  console.log('FINAL PAGE:', finalBody.slice(0, 500).replace(/\n+/g, ' | '))

  expect(page.url()).toMatch(/confirmation|order|success/)
  console.log('\nCONSOLE ERRORS:', errors)
})
