import { test, expect } from '@playwright/test';

test.describe('Shop page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/shop');
  });

  test('loads with product cards', async ({ page }) => {
    const cards = page.locator('.product-card, [class*="product-card"]');
    await expect(cards.first()).toBeVisible({ timeout: 10_000 });
    const count = await cards.count();
    expect(count).toBeGreaterThan(0);
  });

  test('page title contains Shop', async ({ page }) => {
    await expect(page).toHaveTitle(/Shop|One Earth/i);
  });

  test('category filter buttons are present', async ({ page }) => {
    const filterBtns = page.locator('.filter-btn, button[data-filter]');
    await expect(filterBtns.first()).toBeVisible({ timeout: 5_000 });
    expect(await filterBtns.count()).toBeGreaterThan(1);
  });

  test('internal test product is not visible to public', async ({ page }) => {
    const cards = page.locator('.product-card, [class*="product"]');
    const texts = await cards.allTextContents();
    const hasInternal = texts.some(t => t.toLowerCase().includes('internal payment test'));
    expect(hasInternal).toBe(false);
  });

  test('product card has Add to Basket button or link', async ({ page }) => {
    const atcButtons = page.locator('button:has-text("Add to Basket"), button:has-text("Add"), a:has-text("Add to Basket")');
    const count = await atcButtons.count();
    expect(count).toBeGreaterThan(0);
  });

  test('clicking a product card navigates to product page', async ({ page }) => {
    // Click the first product card link
    const productLink = page.locator('a[href^="/products/"]').first();
    const href = await productLink.getAttribute('href');
    await productLink.click();
    await expect(page).toHaveURL(new RegExp(href.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  });
});
