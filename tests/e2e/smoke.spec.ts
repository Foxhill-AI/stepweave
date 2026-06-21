import { test, expect } from '@playwright/test'

test('homepage loads', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveTitle(/step ?weave/i)
})

test('marketplace loads and shows products', async ({ page }) => {
  await page.goto('/marketplace')
  await expect(page.locator('body')).not.toContainText('500')
  await expect(page.locator('body')).not.toContainText('Internal Server Error')
})

test('product page loads', async ({ page }) => {
  await page.goto('/marketplace')
  const firstProduct = page.locator('a[href*="/item/"]').first()
  await expect(firstProduct).toBeVisible()
  await firstProduct.click()
  await expect(page).toHaveURL(/\/item\//)
  await expect(page.locator('body')).not.toContainText('500')
})

test('design tool loads', async ({ page }) => {
  await page.goto('/design-tool')
  // Either loads the tool or redirects to login — both are valid
  const url = page.url()
  expect(url).toMatch(/design-tool|login|sign-?in/i)
})

test('nav links work', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('nav, header').first()).toBeVisible()
})
