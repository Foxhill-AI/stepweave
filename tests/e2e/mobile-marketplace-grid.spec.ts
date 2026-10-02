import { test, expect } from '@playwright/test'
import path from 'path'

const MOBILE_VIEWPORT = { width: 375, height: 812 }
const SCREENSHOT_DIR = path.join(__dirname, 'screenshots')

async function dumpDOMStructure(page: any, label: string) {
  // Dump all class names present on the page that might relate to carousel/marketplace/grid
  const allRelevantClasses = await page.evaluate(() => {
    const all = Array.from(document.querySelectorAll('*'))
    const classSet = new Set<string>()
    all.forEach((el) => {
      el.classList.forEach((cls) => {
        if (
          cls.includes('carousel') ||
          cls.includes('marketplace') ||
          cls.includes('grid') ||
          cls.includes('product') ||
          cls.includes('card') ||
          cls.includes('section') ||
          cls.includes('explore') ||
          cls.includes('home') ||
          cls.includes('scroll')
        ) {
          classSet.add(cls)
        }
      })
    })
    return Array.from(classSet).sort()
  })
  console.log(`[${label}] Relevant class names found in DOM:`, JSON.stringify(allRelevantClasses, null, 2))

  // Dump the top-level <main> or body structure
  const bodyStructure = await page.evaluate(() => {
    function describeEl(el: Element, depth: number): string {
      if (depth > 4) return '...'
      const tag = el.tagName.toLowerCase()
      const cls = el.className ? `.${String(el.className).replace(/\s+/g, '.')}` : ''
      const id = el.id ? `#${el.id}` : ''
      const children = Array.from(el.children)
        .slice(0, 10)
        .map((c) => `\n${'  '.repeat(depth + 1)}${describeEl(c, depth + 1)}`)
        .join('')
      return `${tag}${id}${cls}${children}`
    }
    const main = document.querySelector('main') || document.body
    return describeEl(main, 0)
  })
  console.log(`[${label}] DOM structure (main/body, depth 4):\n${bodyStructure}`)
}

async function inspectMarketplaceSection(page: any, label: string) {
  // First dump DOM to find what's actually there
  await dumpDOMStructure(page, label)

  // Check if .marketplace-content-section exists
  const sectionCount = await page.locator('.marketplace-content-section').count()
  console.log(`[${label}] .marketplace-content-section count: ${sectionCount}`)

  if (sectionCount === 0) {
    console.log(`[${label}] ERROR: No .marketplace-content-section found in DOM`)
    // Try to find carousel-container anyway
    const carouselCount = await page.locator('.carousel-container').count()
    console.log(`[${label}] .carousel-container count (without section wrapper): ${carouselCount}`)
    if (carouselCount > 0) {
      const cardInfo = await page
        .locator('.carousel-container > *')
        .first()
        .evaluate((el: HTMLElement) => {
          const cs = window.getComputedStyle(el)
          return {
            tagName: el.tagName,
            className: el.className,
            offsetWidth: el.offsetWidth,
            parentOffsetWidth: (el.parentElement as HTMLElement)?.offsetWidth,
            computedFlex: cs.flex,
            computedFlexBasis: cs.flexBasis,
            computedMinWidth: cs.minWidth,
            computedMaxWidth: cs.maxWidth,
            computedWidth: cs.width,
            percentageOfParent:
              (el.parentElement as HTMLElement)?.offsetWidth > 0
                ? ((el.offsetWidth / (el.parentElement as HTMLElement).offsetWidth) * 100).toFixed(1) + '%'
                : 'N/A',
          }
        })
        .catch(() => null)
      console.log(`[${label}] First .carousel-container > * card styles (no section wrapper):`, JSON.stringify(cardInfo, null, 2))
    }
    return
  }

  // Check DOM structure: does .marketplace-content-section wrap .carousel-container?
  const carouselInsideSection = await page
    .locator('.marketplace-content-section .carousel-container')
    .count()
  console.log(
    `[${label}] .marketplace-content-section > .carousel-container count: ${carouselInsideSection}`
  )

  // Check if there's a .carousel-container anywhere on the page
  const totalCarousels = await page.locator('.carousel-container').count()
  console.log(`[${label}] Total .carousel-container on page: ${totalCarousels}`)

  // Get the actual DOM structure around the first section
  const sectionHTML = await page
    .locator('.marketplace-content-section')
    .first()
    .evaluate((el: Element) => {
      // Truncate to avoid huge output
      return el.innerHTML.substring(0, 2000)
    })
  console.log(`[${label}] First .marketplace-content-section innerHTML (first 2000 chars):\n${sectionHTML}`)

  // Check the section's class list
  const sectionClasses = await page
    .locator('.marketplace-content-section')
    .first()
    .evaluate((el: Element) => el.className)
  console.log(`[${label}] First section class list: "${sectionClasses}"`)

  // If carousel-container exists inside section, inspect it
  if (carouselInsideSection > 0) {
    const containerStyles = await page
      .locator('.marketplace-content-section .carousel-container')
      .first()
      .evaluate((el: HTMLElement) => {
        const cs = window.getComputedStyle(el)
        return {
          display: cs.display,
          flexDirection: cs.flexDirection,
          flexWrap: cs.flexWrap,
          overflowX: cs.overflowX,
          width: cs.width,
          offsetWidth: el.offsetWidth,
          className: el.className,
        }
      })
    console.log(`[${label}] .carousel-container computed styles:`, JSON.stringify(containerStyles, null, 2))

    // Inspect the first card child
    const firstCard = await page
      .locator('.marketplace-content-section .carousel-container > *')
      .first()
      .evaluate((el: HTMLElement) => {
        const cs = window.getComputedStyle(el)
        return {
          tagName: el.tagName,
          className: el.className,
          offsetWidth: el.offsetWidth,
          parentOffsetWidth: (el.parentElement as HTMLElement)?.offsetWidth,
          computedFlex: cs.flex,
          computedFlexShrink: cs.flexShrink,
          computedFlexGrow: cs.flexGrow,
          computedFlexBasis: cs.flexBasis,
          computedMinWidth: cs.minWidth,
          computedMaxWidth: cs.maxWidth,
          computedWidth: cs.width,
          computedDisplay: cs.display,
          percentageOfParent:
            (el.parentElement as HTMLElement)?.offsetWidth > 0
              ? ((el.offsetWidth / (el.parentElement as HTMLElement).offsetWidth) * 100).toFixed(1) + '%'
              : 'N/A',
        }
      })
    console.log(`[${label}] First card child computed styles:`, JSON.stringify(firstCard, null, 2))
  } else {
    // carousel-container might exist but not inside .marketplace-content-section
    // Let's look for any direct children of sections
    const sectionChildInfo = await page
      .locator('.marketplace-content-section')
      .first()
      .evaluate((el: HTMLElement) => {
        const children = Array.from(el.children).map((child) => ({
          tagName: child.tagName,
          className: (child as HTMLElement).className,
          id: child.id,
        }))
        return children
      })
    console.log(`[${label}] Direct children of first .marketplace-content-section:`, JSON.stringify(sectionChildInfo, null, 2))

    // Try to find carousel-container as sibling or elsewhere
    if (totalCarousels > 0) {
      const carouselParent = await page
        .locator('.carousel-container')
        .first()
        .evaluate((el: HTMLElement) => {
          return {
            parentClass: el.parentElement?.className,
            parentTag: el.parentElement?.tagName,
            grandparentClass: el.parentElement?.parentElement?.className,
            grandparentTag: el.parentElement?.parentElement?.tagName,
          }
        })
      console.log(`[${label}] First .carousel-container's parent info:`, JSON.stringify(carouselParent, null, 2))
    }
  }

  // Also check for any inline styles or CSS custom properties on the section
  const sectionInlineStyle = await page
    .locator('.marketplace-content-section')
    .first()
    .evaluate((el: HTMLElement) => el.getAttribute('style'))
  console.log(`[${label}] First section inline style: "${sectionInlineStyle}"`)

  // Check all stylesheets loaded
  const stylesheets = await page.evaluate(() => {
    return Array.from(document.styleSheets)
      .map((ss) => {
        try {
          return { href: ss.href, rules: ss.cssRules?.length ?? 'N/A (cross-origin)' }
        } catch {
          return { href: ss.href, rules: 'N/A (cross-origin)' }
        }
      })
  })
  console.log(`[${label}] Loaded stylesheets:`, JSON.stringify(stylesheets, null, 2))

  // Search for any CSS rules mentioning marketplace-content-section
  const relevantRules = await page.evaluate(() => {
    const results: string[] = []
    for (const ss of Array.from(document.styleSheets)) {
      try {
        for (const rule of Array.from(ss.cssRules || [])) {
          const text = rule.cssText
          if (
            text.includes('marketplace-content-section') ||
            text.includes('carousel-container') ||
            text.includes('carousel')
          ) {
            results.push(text.substring(0, 500))
          }
        }
      } catch {
        // cross-origin stylesheet, skip
      }
    }
    return results
  })
  console.log(`[${label}] CSS rules mentioning carousel/marketplace (${relevantRules.length} found):`)
  relevantRules.forEach((r, i) => console.log(`  Rule ${i + 1}: ${r}`))
}

test.describe('Mobile Marketplace Grid Diagnosis', () => {
  test.use({ viewport: MOBILE_VIEWPORT })

  test('Homepage - diagnose mobile grid at 375px', async ({ page }) => {
    console.log('\n=== HOMEPAGE DIAGNOSIS ===')
    console.log(`Viewport: ${MOBILE_VIEWPORT.width}x${MOBILE_VIEWPORT.height}`)

    await page.goto('/', { waitUntil: 'networkidle' })

    // Take full-page screenshot first
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'homepage-mobile-full.png'),
      fullPage: true,
    })
    console.log('Full-page screenshot saved: homepage-mobile-full.png')

    // Wait for marketplace section
    const sectionVisible = await page
      .locator('.marketplace-content-section')
      .first()
      .isVisible()
      .catch(() => false)

    if (!sectionVisible) {
      // Maybe it needs scrolling
      await page.evaluate(() => window.scrollTo(0, 500))
      await page.waitForTimeout(500)
    }

    await inspectMarketplaceSection(page, 'HOMEPAGE')

    // Screenshot of the first marketplace area
    const section = page.locator('.marketplace-content-section').first()
    const sectionCnt = await section.count()
    if (sectionCnt > 0) {
      await section.screenshot({
        path: path.join(SCREENSHOT_DIR, 'homepage-mobile-marketplace-section.png'),
      })
      console.log('Section screenshot saved: homepage-mobile-marketplace-section.png')
    }

    // Also check page-level viewport confirmation
    const viewportWidth = await page.evaluate(() => window.innerWidth)
    console.log(`[HOMEPAGE] Confirmed window.innerWidth: ${viewportWidth}`)
  })

  test('Explore page - diagnose mobile grid at 375px', async ({ page }) => {
    console.log('\n=== EXPLORE PAGE DIAGNOSIS ===')
    console.log(`Viewport: ${MOBILE_VIEWPORT.width}x${MOBILE_VIEWPORT.height}`)

    await page.goto('/explore', { waitUntil: 'networkidle' })

    // Take full-page screenshot first
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'explore-mobile-full.png'),
      fullPage: true,
    })
    console.log('Full-page screenshot saved: explore-mobile-full.png')

    // Wait for marketplace section
    await page.waitForSelector('.marketplace-content-section', { timeout: 10000 }).catch(() => {
      console.log('[EXPLORE] .marketplace-content-section never appeared')
    })

    await inspectMarketplaceSection(page, 'EXPLORE')

    // Screenshot of the first marketplace area
    const section = page.locator('.marketplace-content-section').first()
    const sectionCnt = await section.count()
    if (sectionCnt > 0) {
      await section.screenshot({
        path: path.join(SCREENSHOT_DIR, 'explore-mobile-marketplace-section.png'),
      })
      console.log('Section screenshot saved: explore-mobile-marketplace-section.png')
    }

    // Confirmed viewport
    const viewportWidth = await page.evaluate(() => window.innerWidth)
    console.log(`[EXPLORE] Confirmed window.innerWidth: ${viewportWidth}`)
  })
})
