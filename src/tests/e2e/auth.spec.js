import { test, expect } from '@playwright/test';

test.describe('Login page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
  });

  test('login page loads', async ({ page }) => {
    await expect(page).toHaveURL(/\/login/);
    await expect(page.locator('body')).toBeVisible();
  });

  test('Google sign-in button is present', async ({ page }) => {
    const googleBtn = page.locator('button:has-text("Google"), a:has-text("Google")');
    await expect(googleBtn.first()).toBeVisible({ timeout: 5_000 });
  });

  test('email login option is present', async ({ page }) => {
    const emailOption = page.locator('input[type="email"], a:has-text("email"), button:has-text("email")');
    await expect(emailOption.first()).toBeAttached({ timeout: 5_000 });
  });
});

test.describe('Signup page', () => {
  test('signup page loads', async ({ page }) => {
    await page.goto('/signup');
    await expect(page.locator('body')).toBeVisible();
  });
});

test.describe('Auth redirect', () => {
  test('cart page shows login prompt when not authenticated', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('oeg_cart', JSON.stringify([
      { slug: 'ever-bloom-bookmark', name: 'Ever Bloom Bookmark', price: 5, qty: 1, image: '' },
    ])));
    await page.goto('/cart');
    // With no session in localStorage, Supabase returns null → login prompt shown
    await expect(page.locator('#cart-page-login-prompt')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('#cart-page-form-wrap')).toBeHidden();
  });
});
