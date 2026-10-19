import { expect, signIn, test } from './support/fixtures';

test.describe('Atribuição de entregadores', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
  });

  test('sugere a atribuição ótima e aceitar despacha o pedido', async ({ page }) => {
    await page.goto('/atribuicao');
    const ready = page.getByRole('region', { name: 'Pedidos prontos' });
    const couriers = page.getByRole('region', { name: 'Entregadores disponíveis' });
    await expect(ready.getByText('Pedro Almeida')).toBeVisible();
    await expect(couriers.getByText('Ana Ferreira')).toBeVisible();
    // Carlos Santos está com a entrega em andamento do seed: não aparece como livre.
    await expect(couriers.getByText('Carlos Santos')).toHaveCount(0);

    await page.getByRole('button', { name: 'Sugerir atribuição otimizada' }).click();

    // Algoritmo, tempo e distâncias vêm do backend.
    await expect(page.getByText(/Húngaro · [\d,]+ ms/)).toBeVisible();
    const accept = page.getByRole('button', { name: 'Aceitar', exact: true }).first();
    await expect(accept).toBeVisible();
    await expect(page.getByText(/[\d,]+ km/).first()).toBeVisible();

    await accept.click();

    await expect(page.getByText('Despachado').first()).toBeVisible();
  });
});
