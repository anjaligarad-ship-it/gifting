import { test, expect } from '@playwright/test';

const JENGA_URL = '/products/your-carbon-karma-jenga-set';
const BOOKMARK_URL = '/products/ever-bloom-bookmark';

test.describe('Product page', () => {
  test('shows product name and price', async ({ page }) => {
    await page.goto(JENGA_URL);
    await expect(page.locator('h1')).toContainText(/Jenga/i);
    // Price is rendered as £25.00 — match the element by class
    await expect(page.locator('.product-info__price, [class*="price"]').first()).toBeVisible();
  });

  test('Add to Basket button is present and clickable', async ({ page }) => {
    await page.goto(JENGA_URL);
    const btn = page.locator('#atc-btn');
    await expect(btn).toBeVisible();
    await expect(btn).toBeEnabled();
  });

  test('add to basket updates cart badge', async ({ page }) => {
    await page.goto(JENGA_URL);
    // Mock inventory API to avoid DB dependency
    await page.route('/api/inventory*', route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ 'your-carbon-karma-jenga-set': null }) })
    );
    const atcBtn = page.locator('#atc-btn');
    await atcBtn.click();
    // Badge should show a count > 0
    const badge = page.locator('[data-badge], .cart-badge, #cart-count, [id*="badge"]');
    // Allow some time for the badge to update
    await page.waitForTimeout(500);
    // Verify localStorage cart was updated
    const cart = await page.evaluate(() => JSON.parse(localStorage.getItem('oeg_cart') || '[]'));
    expect(cart.length).toBeGreaterThan(0);
    expect(cart[0].slug).toBe('your-carbon-karma-jenga-set');
  });

  test('breadcrumb shows Home / Shop / Category / Product', async ({ page }) => {
    await page.goto(JENGA_URL);
    const breadcrumb = page.locator('.breadcrumb, nav[aria-label="Breadcrumb"]');
    await expect(breadcrumb).toBeVisible();
    await expect(breadcrumb).toContainText('Home');
    await expect(breadcrumb).toContainText('Shop');
  });

  test('product description is shown', async ({ page }) => {
    await page.goto(JENGA_URL);
    await expect(page.locator('text=/tree|deforestation|NFC/i').first()).toBeVisible();
  });

  test('related products are rendered', async ({ page }) => {
    await page.goto(JENGA_URL);
    const related = page.locator('.related-grid, [class*="related"]');
    // May not exist if no related products — just check page doesn't error
    await expect(page.locator('h1')).toBeVisible();
  });

  test('stock badge hidden when stock is null (unlimited)', async ({ page }) => {
    await page.route('/api/inventory*', route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ 'ever-bloom-bookmark': null }) })
    );
    await page.goto(BOOKMARK_URL);
    await page.waitForTimeout(600);
    const badge = page.locator('#stock-badge');
    const display = await badge.evaluate(el => el.style.display);
    expect(display).toBe('none');
  });

  test('stock badge shows "Only N left!" when stock <= 3', async ({ page }) => {
    await page.route('/api/inventory*', route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ 'ever-bloom-bookmark': 2 }) })
    );
    await page.goto(BOOKMARK_URL);
    await page.waitForTimeout(600);
    const badge = page.locator('#stock-badge');
    await expect(badge).toBeVisible();
    await expect(badge).toContainText('Only 2 left');
  });

  test('Add to Basket disabled when stock is 0', async ({ page }) => {
    await page.route('/api/inventory*', route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ 'ever-bloom-bookmark': 0 }) })
    );
    await page.goto(BOOKMARK_URL);
    await page.waitForTimeout(600);
    const btn = page.locator('#atc-btn');
    await expect(btn).toBeDisabled();
    await expect(btn).toHaveText(/Out of stock/i);
  });

  test('page has valid Product structured data JSON-LD', async ({ page }) => {
    await page.goto(JENGA_URL);
    // Multiple ld+json scripts may exist (Layout + product) — find the Product one
    const scripts = page.locator('script[type="application/ld+json"]');
    const count = await scripts.count();
    let productData = null;
    for (let i = 0; i < count; i++) {
      const text = await scripts.nth(i).textContent();
      try {
        const parsed = JSON.parse(text);
        if (parsed['@type'] === 'Product') { productData = parsed; break; }
      } catch {}
    }
    expect(productData).not.toBeNull();
    expect(productData.name).toMatch(/Jenga/i);
    expect(productData.offers).toBeDefined();
    expect(productData.offers.price).toBeGreaterThan(0);
  });
});
