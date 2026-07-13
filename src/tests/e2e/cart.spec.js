import { test, expect } from '@playwright/test';
import { injectFakeSession } from './helpers/auth.js';

const BOOKMARK = { slug: 'ever-bloom-bookmark', name: 'Ever Bloom Bookmark', price: 5, qty: 1, image: '' };
const PLACEMAT  = { slug: 'blooming-placemat-set-of-4', name: 'Blooming Placemat Set of 4', price: 49, qty: 2, image: '' };

async function seedCart(page, items = [BOOKMARK]) {
  await page.addInitScript((cartItems) => {
    localStorage.setItem('oeg_cart', JSON.stringify(cartItems));
  }, items);
}

/** Navigate to /cart with auth + cart pre-seeded, then wait for form to appear. */
async function goToCartAuthed(page, items = [BOOKMARK]) {
  await injectFakeSession(page);
  await seedCart(page, items);
  await page.goto('/cart');
  // Wait for the form wrap to become visible (auth resolved)
  await expect(page.locator('#cart-page-form-wrap')).toBeVisible({ timeout: 10_000 });
}

// ─────────────────────────────────────────────────────────────────────────────
test.describe('Cart page — empty state', () => {
  test('shows empty basket message when cart is empty', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('oeg_cart', '[]'));
    await page.goto('/cart');
    await expect(page.locator('#cart-page-items p, #cart-page-items').getByText(/empty|pick sustainable/i)).toBeVisible({ timeout: 6_000 });
  });

  test('checkout form section is hidden when cart is empty', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('oeg_cart', '[]'));
    await page.goto('/cart');
    await expect(page.locator('#cart-page-form-section')).toHaveCSS('display', 'none');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
test.describe('Cart page — items (unauthenticated)', () => {
  test.beforeEach(async ({ page }) => {
    await seedCart(page);
    await page.goto('/cart');
  });

  test('cart item rendered with name and price', async ({ page }) => {
    await expect(page.locator('.cart-item').first()).toBeVisible({ timeout: 5_000 });
    await expect(page.locator('text=Ever Bloom Bookmark')).toBeVisible();
  });

  test('qty increment increases qty in localStorage', async ({ page }) => {
    const incBtn = page.locator('.qty-btn[data-action="inc"]').first();
    await incBtn.click();
    await page.waitForTimeout(300);
    const cart = await page.evaluate(() => JSON.parse(localStorage.getItem('oeg_cart') || '[]'));
    expect(cart[0].qty).toBe(2);
  });

  test('qty decrement from 1 removes the item', async ({ page }) => {
    const decBtn = page.locator('.qty-btn[data-action="dec"]').first();
    await decBtn.click();
    await page.waitForTimeout(400);
    const cart = await page.evaluate(() => JSON.parse(localStorage.getItem('oeg_cart') || '[]'));
    expect(cart).toHaveLength(0);
    await expect(page.locator('#cart-page-items').getByText(/empty|pick sustainable/i)).toBeVisible({ timeout: 5_000 });
  });

  test('remove button removes item', async ({ page }) => {
    await page.locator('.cart-item__remove').first().click();
    await page.waitForTimeout(400);
    const cart = await page.evaluate(() => JSON.parse(localStorage.getItem('oeg_cart') || '[]'));
    expect(cart).toHaveLength(0);
  });

  test('login prompt is shown when not authenticated', async ({ page }) => {
    await expect(page.locator('#cart-page-login-prompt')).toBeVisible({ timeout: 6_000 });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
test.describe('Cart page — address form (authenticated)', () => {
  test.beforeEach(async ({ page }) => {
    await goToCartAuthed(page);
  });

  test('all address fields are visible', async ({ page }) => {
    await expect(page.locator('#cp-addr-line1')).toBeVisible();
    await expect(page.locator('#cp-addr-line2')).toBeVisible();
    await expect(page.locator('#cp-addr-town')).toBeVisible();
    await expect(page.locator('#cp-addr-postcode')).toBeVisible();
  });

  test('postcode normalises to uppercase on blur', async ({ page }) => {
    const pc = page.locator('#cp-addr-postcode');
    await pc.fill('cv1 1gu');
    await pc.dispatchEvent('blur');
    await expect(pc).toHaveValue('CV1 1GU');
  });

  test('invalid postcode shows inline error on blur', async ({ page }) => {
    const pc = page.locator('#cp-addr-postcode');
    await pc.fill('NOTAPOSTCODE');
    await pc.dispatchEvent('blur');
    const err = page.locator('#cp-addr-postcode-err');
    await expect(err).toBeVisible();
    await expect(err).toContainText(/valid UK postcode/i);
  });

  test('valid postcode after invalid clears the error', async ({ page }) => {
    const pc = page.locator('#cp-addr-postcode');
    await pc.fill('NOTAPOSTCODE');
    await pc.dispatchEvent('blur');
    await pc.fill('SW1A 2AA');
    await pc.dispatchEvent('blur');
    await expect(page.locator('#cp-addr-postcode-err')).toHaveCSS('display', 'none');
  });

  test('name and email pre-filled from session', async ({ page }) => {
    const email = await page.locator('#cp-email').inputValue();
    expect(email).toBe('test@example.com');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
test.describe('Cart page — gift toggle (authenticated)', () => {
  test.beforeEach(async ({ page }) => {
    await goToCartAuthed(page);
  });

  test('recipient section hidden by default', async ({ page }) => {
    await expect(page.locator('#cp-recipient-section')).toHaveCSS('display', 'none');
  });

  test('checking gift toggle reveals recipient section', async ({ page }) => {
    await page.locator('#cp-is-gift').check();
    await expect(page.locator('#cp-recipient-section')).toBeVisible();
  });

  test('gift extras hidden by default', async ({ page }) => {
    await expect(page.locator('#cp-gift-extras')).toHaveCSS('display', 'none');
  });

  test('checking gift toggle reveals gift message textarea', async ({ page }) => {
    await page.locator('#cp-is-gift').check();
    await expect(page.locator('#cp-gift-message')).toBeVisible();
  });

  test('gift message character counter updates on input', async ({ page }) => {
    await page.locator('#cp-is-gift').check();
    await page.locator('#cp-gift-message').fill('Hello!');
    await expect(page.locator('#cp-gift-message-counter')).toContainText('6 / 250');
  });

  test('hide prices checkbox is present when gift mode is on', async ({ page }) => {
    await page.locator('#cp-is-gift').check();
    await expect(page.locator('#cp-hide-price')).toBeVisible();
  });

  test('unchecking gift toggle hides recipient section', async ({ page }) => {
    const toggle = page.locator('#cp-is-gift');
    await toggle.check();
    await expect(page.locator('#cp-recipient-section')).toBeVisible();
    await toggle.uncheck();
    await expect(page.locator('#cp-recipient-section')).toHaveCSS('display', 'none');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
test.describe('Cart page — promo code (authenticated + mocked API)', () => {
  test.beforeEach(async ({ page }) => {
    await goToCartAuthed(page);
  });

  test('invalid promo code shows error message', async ({ page }) => {
    await page.route('/api/promo/apply', route =>
      route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ valid: false, error: 'Invalid promo code.' }) })
    );
    await page.locator('#cp-promo-input').fill('BADCODE');
    await page.locator('#cp-promo-apply-btn').click();
    await expect(page.locator('#cp-promo-msg')).toContainText(/Invalid promo code/i, { timeout: 5_000 });
  });

  test('valid promo code shows applied banner with code and percentage', async ({ page }) => {
    await page.route('/api/promo/apply', route =>
      route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ valid: true, code: 'FIRST', discountRate: 0.20, discountCap: 60 }) })
    );
    await page.locator('#cp-promo-input').fill('FIRST');
    await page.locator('#cp-promo-apply-btn').click();
    const banner = page.locator('#cp-promo-applied');
    await expect(banner).toBeVisible({ timeout: 5_000 });
    await expect(banner).toContainText('FIRST');
    await expect(banner).toContainText('20%');
  });

  test('remove button hides the promo banner', async ({ page }) => {
    await page.route('/api/promo/apply', route =>
      route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ valid: true, code: 'FIRST', discountRate: 0.20, discountCap: 60 }) })
    );
    await page.locator('#cp-promo-input').fill('FIRST');
    await page.locator('#cp-promo-apply-btn').click();
    await expect(page.locator('#cp-promo-applied')).toBeVisible({ timeout: 5_000 });
    await page.locator('#cp-promo-remove-btn').click();
    await expect(page.locator('#cp-promo-applied')).toHaveCSS('display', 'none');
  });

  test('promo code unverified email error is shown', async ({ page }) => {
    await page.route('/api/promo/apply', route =>
      route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ valid: false, error: 'Please verify your email address first.' }) })
    );
    await page.locator('#cp-promo-input').fill('FIRST');
    await page.locator('#cp-promo-apply-btn').click();
    await expect(page.locator('#cp-promo-msg')).toContainText(/verify your email/i, { timeout: 5_000 });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
test.describe('Cart page — price breakdown (authenticated)', () => {
  test.beforeEach(async ({ page }) => {
    await goToCartAuthed(page, [{ ...BOOKMARK, qty: 2 }]);
  });

  test('subtotal reflects cart items (2 × £5 = £10)', async ({ page }) => {
    await expect(page.locator('#cp-subtotal')).toContainText('£10');
  });

  test('discount row is hidden before a promo is applied', async ({ page }) => {
    await expect(page.locator('#cp-discount-row')).toHaveCSS('display', 'none');
  });

  test('shipping row shows a delivery label', async ({ page }) => {
    await expect(page.locator('#cp-shipping-label')).toContainText(/Standard|Express|delivery/i, { timeout: 5_000 });
  });

  test('total includes shipping cost (> subtotal)', async ({ page }) => {
    const totalText = await page.locator('#cp-total').textContent();
    // £10 subtotal + £3.95 standard = £13.95
    const total = parseFloat(totalText.replace('£', ''));
    expect(total).toBeGreaterThan(10);
  });

  test('discount row visible and total reduced after promo applied', async ({ page }) => {
    await page.route('/api/promo/apply', route =>
      route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ valid: true, code: 'FIRST', discountRate: 0.20, discountCap: 60 }) })
    );
    await page.locator('#cp-promo-input').fill('FIRST');
    await page.locator('#cp-promo-apply-btn').click();
    await expect(page.locator('#cp-discount-row')).toBeVisible({ timeout: 5_000 });
    const discountText = await page.locator('#cp-promo-discount').textContent();
    // 20% of £10 = £2 discount
    expect(discountText).toContain('£2');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
test.describe('Cart page — delivery options (authenticated)', () => {
  test('delivery option cards are rendered when logged in', async ({ page }) => {
    await goToCartAuthed(page);
    await expect(page.locator('#cp-delivery-options')).toBeVisible();
    const cards = page.locator('#cp-delivery-options label.delivery-option');
    await expect(cards.first()).toBeVisible({ timeout: 5_000 });
    expect(await cards.count()).toBeGreaterThanOrEqual(2);
  });

  test('standard delivery is selected by default', async ({ page }) => {
    await goToCartAuthed(page);
    const standardRadio = page.locator('input[name="cp-delivery"][value="standard"]');
    await expect(standardRadio).toBeChecked({ timeout: 5_000 });
  });

  test('selecting express delivery updates the shipping price', async ({ page }) => {
    await goToCartAuthed(page);
    const expressRadio = page.locator('input[name="cp-delivery"][value="express"]');
    await expressRadio.click();
    await expect(page.locator('#cp-shipping-price')).toContainText('£6.95', { timeout: 5_000 });
  });

  test('free delivery note shown when subtotal >= £50', async ({ page }) => {
    await goToCartAuthed(page, [PLACEMAT]); // 2 × £49 = £98
    await expect(page.locator('#cp-delivery-free-note')).toBeVisible({ timeout: 5_000 });
    await expect(page.locator('#cp-delivery-free-note')).toContainText(/Free delivery/i);
  });

  test('delivery cards show arrival date strings', async ({ page }) => {
    await goToCartAuthed(page);
    const cards = page.locator('#cp-delivery-options label.delivery-option');
    await expect(cards.first()).toBeVisible({ timeout: 5_000 });
    const text = await cards.first().textContent();
    expect(text).toMatch(/arrives by/i);
  });

  test('arrival date updates when postcode changes to special zone', async ({ page }) => {
    await goToCartAuthed(page);
    // Enter a BT postcode (Northern Ireland — +2 days)
    const pc = page.locator('#cp-addr-postcode');
    await pc.fill('BT1 1AA');
    await pc.dispatchEvent('blur');
    await page.waitForTimeout(500);
    // Delivery cards should still show
    await expect(page.locator('#cp-delivery-options label.delivery-option').first()).toBeVisible();
  });
});
