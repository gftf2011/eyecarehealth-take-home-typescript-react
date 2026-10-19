import type { Browser, Page } from '@playwright/test';

import { expect, signIn, test, unique } from './support/fixtures';

/** Um segundo gestor, em outro navegador (contexto isolado: cookies e sessão próprios). */
async function anotherManager(browser: Browser, path: string): Promise<{ page: Page; close: () => Promise<void> }> {
  const context = await browser.newContext();
  const page = await context.newPage();
  await signIn(page);
  await page.goto(path);
  await expect(page.getByRole('status', { name: /Ao vivo/ })).toBeVisible();
  return { page, close: () => context.close() };
}

test.describe('Tempo real (outbox → SNS FIFO → SQS FIFO → gateway → WebSocket)', () => {
  test('produto pausado por um gestor aparece pausado para o outro, sem recarregar', async ({ page, browser, api }) => {
    const product = await api.createProduct({ name: unique('Panqueca') });
    await signIn(page);
    await page.goto('/produtos');
    await expect(page.getByRole('status', { name: /Ao vivo/ })).toBeVisible();
    const other = await anotherManager(browser, '/produtos');
    const otherToggle = other.page.getByRole('switch', { name: `Disponível: ${product.name}` });
    await expect(otherToggle).toBeChecked();

    await page.getByRole('switch', { name: `Disponível: ${product.name}` }).click();

    await expect(otherToggle).not.toBeChecked();
    await other.close();
  });

  test('pedido novo e mudança de status chegam ao painel aberto, sem recarregar', async ({ page, api }) => {
    await signIn(page);
    await page.goto('/pedidos');
    await expect(page.getByRole('status', { name: /Ao vivo/ })).toBeVisible();
    const customer = unique('Cliente Ao Vivo');

    const order = await api.placeOrder(customer);
    const row = page.getByRole('listitem').filter({ has: page.getByRole('button', { name: `Ver detalhes do pedido de ${customer}` }) });
    await expect(row).toBeVisible();
    await expect(row).toContainText('Pendente');

    await api.changeStatus(order.id, 'preparing');

    await expect(row).toContainText('Em preparo');
  });
});
