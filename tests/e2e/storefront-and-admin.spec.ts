import { test, expect } from '@playwright/test';

test.describe('Anis Criações E-Commerce End-to-End & Responsive Verification', () => {
  test('renders storefront home, catalog filters, product personalization, cart, and protects /admin', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(page.locator('h1')).toContainText('Presentes com alma');

    // Navigate to Catalog
    await page.goto('/catalogo');
    await expect(page.locator('h1')).toContainText('Catálogo de Presentes');

    // Open personalized product
    await page.goto('/produto/album-memorias-linho-puro-hot-stamping');
    await expect(page.locator('h1')).toContainText('Álbum de Memórias em Linho Puro');

    // Fill personalization fields
    await page.getByTestId('personalization-titulo_capa').fill('Viagem Toscana');
    await page.getByTestId('color-option-terracota_suave').click();
    await page
      .getByTestId('personalization-acabamento_gravacao')
      .selectOption('bordado_relevo');

    // Add to cart
    await page.getByTestId('add-to-cart-btn').click();
    await expect(page).toHaveURL(/\/carrinho/);
    await expect(page.getByTestId('cart-count-badge')).toHaveText('1');

    // Test invalid coupon feedback
    await page.getByTestId('cart-coupon-input').fill('INVALIDO99');
    await page.getByTestId('cart-apply-coupon-btn').click();
    await expect(page.getByTestId('coupon-error-msg')).toContainText('inválido');

    // Protected /admin route shows authentication gate
    await page.goto('/admin');
    await expect(page.getByTestId('admin-login-submit')).toBeVisible();
  });
});
