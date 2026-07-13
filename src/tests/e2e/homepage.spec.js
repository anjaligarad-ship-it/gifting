import { test, expect } from '@playwright/test';

test.describe('Homepage', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('page title contains One Earth Gifting', async ({ page }) => {
    await expect(page).toHaveTitle(/One Earth Gifting/i);
  });

  test('promo banner is visible with FIRST code', async ({ page }) => {
    const banner = page.locator('.homepage-promo-bar');
    await expect(banner).toBeVisible();
    await expect(banner).toContainText('FIRST');
    await expect(banner).toContainText('20%');
  });

  test('promo banner has Shop Now link pointing to /cart', async ({ page }) => {
    const link = page.locator('.homepage-promo-bar a');
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute('href', '/cart');
  });

  test('site header is present with navigation', async ({ page }) => {
    await expect(page.locator('header')).toBeVisible();
  });

  test('shop link navigates to /shop', async ({ page }) => {
    const shopLink = page.locator('a[href="/shop"]').first();
    await expect(shopLink).toBeVisible();
    await shopLink.click();
    await expect(page).toHaveURL(/\/shop/);
  });

  test('page has no console errors on load', async ({ page }) => {
    const errors = [];
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    expect(errors.filter(e => !e.includes('favicon') && !e.includes('supabase') && !e.includes('net::ERR'))).toHaveLength(0);
  });
});
