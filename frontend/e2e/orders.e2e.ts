import { expect, signIn, test, unique } from './support/fixtures';

test.describe('Pedidos', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
  });

  test('o painel lista os pedidos do seed e filtra por status pela URL', async ({ page }) => {
    await page.goto('/pedidos');
    const list = page.getByRole('list', { name: 'Pedidos' });
    await expect(list.getByRole('button', { name: 'Ver detalhes do pedido de Joao Silva' })).toBeVisible();

    await page.getByLabel('Status').selectOption('ready');

    await expect(page).toHaveURL(/status=ready/);
    await expect(list.getByRole('button', { name: 'Ver detalhes do pedido de Pedro Almeida' })).toBeVisible();
    await expect(list.getByRole('button', { name: 'Ver detalhes do pedido de Joao Silva' })).toHaveCount(0);
  });

  test('o detalhe mostra só as transições válidas e muda o status', async ({ page, api }) => {
    const customer = unique('Cliente Detalhe');
    await api.placeOrder(customer);
    await page.goto('/pedidos');

    await page.getByRole('button', { name: `Ver detalhes do pedido de ${customer}` }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toContainText('Pendente');
    // De pending só se vai para preparing ou cancelled.
    await expect(dialog.getByRole('button', { name: 'Iniciar preparo' })).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Marcar como pronto' })).toHaveCount(0);

    await dialog.getByRole('button', { name: 'Iniciar preparo' }).click();

    await expect(dialog.getByRole('button', { name: 'Marcar como pronto' })).toBeVisible();
    await expect(dialog).toContainText('Em preparo');
  });

  test('despachar pela lista exige entregador: o painel explica e manda para a atribuição', async ({ page, api }) => {
    const customer = unique('Cliente Pronto');
    const order = await api.placeOrder(customer);
    await api.changeStatus(order.id, 'preparing');
    await api.changeStatus(order.id, 'ready');
    await page.goto('/pedidos');

    await page.getByRole('button', { name: `Ver detalhes do pedido de ${customer}` }).click();
    const dialog = page.getByRole('dialog');

    await expect(dialog.getByText('Atribua um entregador na tela de atribuição para despachar.')).toBeVisible();
  });
});
