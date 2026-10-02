# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: mobile-grid-count.spec.ts >> homepage mobile grid item count
- Location: tests/e2e/mobile-grid-count.spec.ts:3:5

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: 4
Received: 3
```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e2]:
    - navigation "Main navigation" [ref=e3]:
      - generic [ref=e4]:
        - link "Step Weave home" [ref=e7] [cursor=pointer]:
          - /url: /
          - img [ref=e8]
        - button "Toggle mobile menu" [ref=e11] [cursor=pointer]:
          - img [ref=e12]
    - navigation "Secondary navigation" [ref=e13]:
      - generic [ref=e16]:
        - img [ref=e17]
        - textbox "Search products and creators" [ref=e20]:
          - /placeholder: Search products, creators...
        - button "Toggle filters" [ref=e21] [cursor=pointer]:
          - img [ref=e22]
    - main [ref=e23]:
      - generic [ref=e24]:
        - region "Trending Now" [ref=e25]:
          - generic [ref=e26]:
            - heading "Trending Now" [level=2] [ref=e28]
            - link "View all" [ref=e29] [cursor=pointer]:
              - /url: /explore/trending-now
              - text: View all
              - img [ref=e30]
          - generic [ref=e32]:
            - 'article "Item: Flower kicks" [ref=e34]':
              - 'link "Flower kicks Flower kicks Price: $60.00" [ref=e35] [cursor=pointer]':
                - /url: /item/70
                - img "Flower kicks" [ref=e38]
                - generic [ref=e39]:
                  - heading "Flower kicks" [level=3] [ref=e40]
                  - 'generic "Price: $60.00" [ref=e42]': $60.00
            - 'article "Item: Toes of Life" [ref=e44]':
              - 'link "Toes of Life Badge: New Toes of Life Price: $99.00" [ref=e45] [cursor=pointer]':
                - /url: /item/98
                - generic [ref=e46]:
                  - img "Toes of Life" [ref=e48]
                  - 'generic "Badge: New" [ref=e49]': New
                - generic [ref=e50]:
                  - heading "Toes of Life" [level=3] [ref=e51]
                  - 'generic "Price: $99.00" [ref=e53]': $99.00
            - 'article "Item: Space Cats" [ref=e55]':
              - 'link "Space Cats Badge: New Space Cats Price: $75.00" [ref=e56] [cursor=pointer]':
                - /url: /item/97
                - generic [ref=e57]:
                  - img "Space Cats" [ref=e59]
                  - 'generic "Badge: New" [ref=e60]': New
                - generic [ref=e61]:
                  - heading "Space Cats" [level=3] [ref=e62]
                  - 'generic "Price: $75.00" [ref=e64]': $75.00
          - button "View more" [ref=e66] [cursor=pointer]:
            - generic [ref=e67]: View more
            - img [ref=e68]
        - region "Most Popular" [ref=e70]:
          - generic [ref=e71]:
            - heading "Most Popular" [level=2] [ref=e73]
            - link "View all" [ref=e74] [cursor=pointer]:
              - /url: /explore/most-popular
              - text: View all
              - img [ref=e75]
          - generic [ref=e77]:
            - 'article "Item: Toes of Life" [ref=e79]':
              - 'link "T Badge: New Toes of Life Price: $99.00" [ref=e80] [cursor=pointer]':
                - /url: /item/98
                - generic [ref=e81]:
                  - generic [ref=e84]: T
                  - 'generic "Badge: New" [ref=e85]': New
                - generic [ref=e86]:
                  - heading "Toes of Life" [level=3] [ref=e87]
                  - 'generic "Price: $99.00" [ref=e89]': $99.00
            - 'article "Item: Bright Eyed" [ref=e91]':
              - 'link "Bright Eyed Bright Eyed Price: $60.00" [ref=e92] [cursor=pointer]':
                - /url: /item/95
                - img "Bright Eyed" [ref=e95]
                - generic [ref=e96]:
                  - heading "Bright Eyed" [level=3] [ref=e97]
                  - 'generic "Price: $60.00" [ref=e99]': $60.00
            - 'article "Item: Space Cats" [ref=e101]':
              - 'link "S Badge: New Space Cats Price: $75.00" [ref=e102] [cursor=pointer]':
                - /url: /item/97
                - generic [ref=e103]:
                  - generic [ref=e106]: S
                  - 'generic "Badge: New" [ref=e107]': New
                - generic [ref=e108]:
                  - heading "Space Cats" [level=3] [ref=e109]
                  - 'generic "Price: $75.00" [ref=e111]': $75.00
          - button "View more" [ref=e113] [cursor=pointer]:
            - generic [ref=e114]: View more
            - img [ref=e115]
        - region "Brand New" [ref=e117]:
          - generic [ref=e118]:
            - heading "Brand New" [level=2] [ref=e120]
            - link "View all" [ref=e121] [cursor=pointer]:
              - /url: /explore/brand-new
              - text: View all
              - img [ref=e122]
          - generic [ref=e124]:
            - 'article "Item: Toes of Life" [ref=e126]':
              - 'link "T Badge: New Toes of Life Price: $99.00" [ref=e127] [cursor=pointer]':
                - /url: /item/98
                - generic [ref=e128]:
                  - generic [ref=e131]: T
                  - 'generic "Badge: New" [ref=e132]': New
                - generic [ref=e133]:
                  - heading "Toes of Life" [level=3] [ref=e134]
                  - 'generic "Price: $99.00" [ref=e136]': $99.00
            - 'article "Item: Space Cats" [ref=e138]':
              - 'link "S Badge: New Space Cats Price: $75.00" [ref=e139] [cursor=pointer]':
                - /url: /item/97
                - generic [ref=e140]:
                  - generic [ref=e143]: S
                  - 'generic "Badge: New" [ref=e144]': New
                - generic [ref=e145]:
                  - heading "Space Cats" [level=3] [ref=e146]
                  - 'generic "Price: $75.00" [ref=e148]': $75.00
            - 'article "Item: Space Kicks" [ref=e150]':
              - 'link "Space Kicks Badge: New Space Kicks Price: $65.00" [ref=e151] [cursor=pointer]':
                - /url: /item/96
                - generic [ref=e152]:
                  - img "Space Kicks" [ref=e154]
                  - 'generic "Badge: New" [ref=e155]': New
                - generic [ref=e156]:
                  - heading "Space Kicks" [level=3] [ref=e157]
                  - 'generic "Price: $65.00" [ref=e159]': $65.00
          - button "View more" [ref=e161] [cursor=pointer]:
            - generic [ref=e162]: View more
            - img [ref=e163]
    - button "Back to the top" [ref=e167] [cursor=pointer]:
      - generic [ref=e168]: Back to the top
    - contentinfo [ref=e169]:
      - generic [ref=e170]:
        - generic [ref=e171]:
          - button "About StepWeave" [ref=e173] [cursor=pointer]:
            - heading "About StepWeave" [level=3] [ref=e174]
            - img [ref=e175]
          - button "Help & Support" [ref=e178] [cursor=pointer]:
            - heading "Help & Support" [level=3] [ref=e179]
            - img [ref=e180]
          - button "Connect" [ref=e183] [cursor=pointer]:
            - heading "Connect" [level=3] [ref=e184]
            - img [ref=e185]
          - button "Newsletter" [ref=e188] [cursor=pointer]:
            - heading "Newsletter" [level=3] [ref=e189]
            - img [ref=e190]
        - generic [ref=e192]:
          - paragraph [ref=e193]: © 2026 StepWeave. All rights reserved.
          - generic [ref=e194]:
            - link "Terms of Use" [ref=e195] [cursor=pointer]:
              - /url: /terms
            - generic [ref=e196]: •
            - link "Privacy Policy" [ref=e197] [cursor=pointer]:
              - /url: /privacy
            - generic [ref=e198]: •
            - link "Cookie Policy" [ref=e199] [cursor=pointer]:
              - /url: /cookies
            - generic [ref=e200]: •
            - button "Cookie Settings" [ref=e201] [cursor=pointer]
            - generic [ref=e202]: •
            - link "Accessibility" [ref=e203] [cursor=pointer]:
              - /url: /accessibility
            - generic [ref=e204]: •
            - link "Community Guidelines" [ref=e205] [cursor=pointer]:
              - /url: /guidelines
  - alert [ref=e206]
  - dialog "Cookie consent" [ref=e207]:
    - generic [ref=e208]:
      - generic [ref=e209]:
        - strong [ref=e210]: We use cookies
        - paragraph [ref=e211]:
          - text: Essential cookies make Step Weave work. With your consent, we also use analytics, functional, and marketing cookies to improve the site and personalize content. See our
          - link "Cookie Policy" [ref=e212] [cursor=pointer]:
            - /url: /cookies
          - text: for details.
      - generic [ref=e213]:
        - button "Customize" [ref=e214] [cursor=pointer]
        - button "Reject non-essential" [ref=e215] [cursor=pointer]
        - button "Accept all" [ref=e216] [cursor=pointer]
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test'
  2  | 
  3  | test('homepage mobile grid item count', async ({ page }) => {
  4  |   // 1. Open at 375px wide mobile viewport
  5  |   await page.setViewportSize({ width: 375, height: 812 })
  6  |   await page.goto('https://www.stepweave.com')
  7  | 
  8  |   // 2. Wait for .content-section-grid to appear
  9  |   await page.waitForSelector('.content-section-grid', { timeout: 20_000 })
  10 | 
  11 |   // 3. Count visible .content-section-grid-item elements in the first grid
  12 |   const firstGrid = page.locator('.content-section-grid').first()
  13 |   const items = firstGrid.locator('.content-section-grid-item')
  14 |   const count = await items.count()
  15 | 
  16 |   // 4. Log the count
  17 |   console.log(`[mobile-grid-count] First .content-section-grid item count: ${count}`)
  18 | 
  19 |   // 5. Check if page HTML contains "HOME_SECTION_GRID_INITIAL"
  20 |   const html = await page.content()
  21 |   const containsConfigKey = html.includes('HOME_SECTION_GRID_INITIAL')
  22 |   console.log(`[mobile-grid-count] Page HTML contains "HOME_SECTION_GRID_INITIAL": ${containsConfigKey}`)
  23 | 
  24 |   // 6. Grab full outer HTML of the first .content-section-grid
  25 |   const gridOuterHtml = await firstGrid.evaluate((el) => el.outerHTML)
  26 |   console.log('[mobile-grid-count] First .content-section-grid outerHTML (truncated to 2000 chars):')
  27 |   console.log(gridOuterHtml.slice(0, 2000))
  28 | 
  29 |   // 7. Check for hardcoded initialVisibleCount in page source
  30 |   const containsInitialVisibleCount = html.includes('initialVisibleCount')
  31 |   console.log(`[mobile-grid-count] Page source contains "initialVisibleCount": ${containsInitialVisibleCount}`)
  32 | 
  33 |   // Also log all numeric values near "initialVisibleCount" if present
  34 |   const matches = [...html.matchAll(/initialVisibleCount[^0-9]*(\d+)/g)]
  35 |   if (matches.length > 0) {
  36 |     matches.forEach((m) => {
  37 |       console.log(`[mobile-grid-count] initialVisibleCount value found in source: ${m[1]}`)
  38 |     })
  39 |   }
  40 | 
  41 |   // 8. Take a screenshot
  42 |   await page.screenshot({ path: 'tests/e2e/mobile-grid-count.png', fullPage: false })
  43 |   console.log('[mobile-grid-count] Screenshot saved to tests/e2e/mobile-grid-count.png')
  44 | 
  45 |   // Assertion: expect 4 items based on config (will fail if override is 3)
> 46 |   expect(count).toBe(4)
     |                 ^ Error: expect(received).toBe(expected) // Object.is equality
  47 | })
  48 | 
```