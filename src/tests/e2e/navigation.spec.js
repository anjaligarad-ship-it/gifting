import { test, expect } from '@playwright/test';

test.describe('Site navigation', () => {
  test('/ → /shop navigation works', async ({ page }) => {
    await page.goto('/');
    await page.locator('a[href="/shop"]').first().click();
    await expect(page).toHaveURL(/\/shop/);
  });

  test('/shop → product page navigation works', async ({ page }) => {
    await page.goto('/shop');
    const firstProductLink = page.locator('a[href^="/products/"]').first();
    await firstProductLink.click();
    await expect(page).toHaveURL(/\/products\//);
  });

  test('cart icon/link navigates to /cart', async ({ page }) => {
    await page.goto('/');
    const cartLink = page.locator('a[href="/cart"]').first();
    await cartLink.click();
    await expect(page).toHaveURL(/\/cart/);
  });

  test('promo banner Shop Now → /cart', async ({ page }) => {
    await page.goto('/');
    await page.locator('.homepage-promo-bar a').click();
    await expect(page).toHaveURL(/\/cart/);
  });

  test('promo banner is present on shop page (sitewide)', async ({ page }) => {
    await page.goto('/shop');
    const banner = page.locator('.homepage-promo-bar');
    await expect(banner).toBeVisible();
  });

  test('promo banner is present on product page (sitewide)', async ({ page }) => {
    await page.goto('/products/ever-bloom-bookmark');
    const banner = page.locator('.homepage-promo-bar');
    await expect(banner).toBeVisible();
  });

  test('promo banner is present on cart page (sitewide)', async ({ page }) => {
    await page.goto('/cart');
    const banner = page.locator('.homepage-promo-bar');
    await expect(banner).toBeVisible();
  });
});

test.describe('404 handling', () => {
  test('non-existent route shows error or redirects', async ({ page }) => {
    const response = await page.goto('/this-page-does-not-exist-xyz');
    // Either 404 status or redirect to home/shop
    expect(response.status()).toBeLessThan(500);
  });
});
