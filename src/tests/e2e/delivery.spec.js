import { test, expect } from '@playwright/test';
import { injectFakeSession } from './helpers/auth.js';

const BOOKMARK = { slug: 'ever-bloom-bookmark', name: 'Ever Bloom Bookmark', price: 5, qty: 1, image: '' };
const PLACEMAT  = { slug: 'blooming-placemat-set-of-4', name: 'Blooming Placemat', price: 49, qty: 2, image: '' };

async function goToCartAuthed(page, items) {
  await injectFakeSession(page);
  await page.addInitScript((cartItems) => {
    localStorage.setItem('oeg_cart', JSON.stringify(cartItems));
  }, items);
  await page.goto('/cart');
  await expect(page.locator('#cart-page-form-wrap')).toBeVisible({ timeout: 10_000 });
}

test.describe('Delivery option UI (C1)', () => {
  test.beforeEach(async ({ page }) => {
    await goToCartAuthed(page, [BOOKMARK]);
  });

  test('delivery section container exists', async ({ page }) => {
    await expect(page.locator('#cp-delivery-section')).toBeVisible();
  });

  test('shipping price row is in the price breakdown', async ({ page }) => {
    await expect(page.locator('#cp-shipping-row')).toBeVisible();
    await expect(page.locator('#cp-shipping-price')).toBeVisible();
  });

  test('standard delivery option rendered and selected by default', async ({ page }) => {
    await expect(page.locator('input[name="cp-delivery"][value="standard"]')).toBeChecked();
    await expect(page.locator('#cp-shipping-price')).toContainText('£3.95');
  });

  test('express delivery option is rendered', async ({ page }) => {
    await expect(page.locator('input[name="cp-delivery"][value="express"]')).toBeAttached();
  });

  test('switching to express updates shipping price to £6.95', async ({ page }) => {
    await page.locator('input[name="cp-delivery"][value="express"]').click();
    await expect(page.locator('#cp-shipping-price')).toContainText('£6.95', { timeout: 3_000 });
  });

  test('delivery cards show estimated arrival dates', async ({ page }) => {
    const firstCard = page.locator('#cp-delivery-options label.delivery-option').first();
    await expect(firstCard).toBeVisible();
    await expect(firstCard).toContainText(/arrives by/i);
  });

  test('total includes shipping (£5 subtotal + £3.95 standard = £8.95)', async ({ page }) => {
    const totalText = await page.locator('#cp-total').textContent();
    expect(parseFloat(totalText.replace('£', ''))).toBeCloseTo(8.95, 1);
  });
});

test.describe('Free delivery threshold (authenticated)', () => {
  test('free delivery note shown when subtotal meets £50 threshold', async ({ page }) => {
    await goToCartAuthed(page, [PLACEMAT]); // 2 × £49 = £98
    await expect(page.locator('#cp-delivery-free-note')).toBeVisible({ timeout: 5_000 });
    await expect(page.locator('#cp-delivery-free-note')).toContainText(/Free delivery/i);
  });

  test('shipping price shows Free when threshold met', async ({ page }) => {
    await goToCartAuthed(page, [PLACEMAT]);
    await expect(page.locator('#cp-shipping-price')).toContainText(/Free/i, { timeout: 5_000 });
  });
});
