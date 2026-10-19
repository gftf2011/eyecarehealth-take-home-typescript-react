import { expect, signIn, test, unique } from './support/fixtures';

test.describe('Pedidos', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
  });

  test('o painel lista os pedidos e filtra por status pela URL', async ({ page, api }) => {
    // Pedidos próprios: os do seed mudam de status em outros testes (a
    // atribuição despacha o pedido pronto do seed).
    const pending = unique('Cliente Pendente');
    const ready = unique('Cliente Pronto');
    await api.placeOrder(pending);
    const order = await api.placeOrder(ready);
    await api.changeStatus(order.id, 'preparing');
    await api.changeStatus(order.id, 'ready');

    await page.goto('/pedidos');
    const list = page.getByRole('list', { name: 'Pedidos' });
    await expect(list.getByRole('button', { name: `Ver detalhes do pedido de ${pending}` })).toBeVisible();

    await page.getByLabel('Status').selectOption('ready');

    await expect(page).toHaveURL(/status=ready/);
    await expect(list.getByRole('button', { name: `Ver detalhes do pedido de ${ready}` })).toBeVisible();
    await expect(list.getByRole('button', { name: `Ver detalhes do pedido de ${pending}` })).toHaveCount(0);
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

  test('entrega sem contato volta para a atribuição com motivo, e o entregador fica livre', async ({ page, api }) => {
    const courier = await api.registerDeliveryPerson(unique('Entregador Sumido'));
    const customer = unique('Cliente Devolvido');
    const order = await api.placeOrder(customer);
    await api.changeStatus(order.id, 'preparing');
    await api.changeStatus(order.id, 'ready');
    await api.dispatch(order.id, courier.id);
    await page.goto(`/pedidos?order=${order.id}`);
    const details = page.getByRole('dialog', { name: 'Detalhes do pedido' });
    await expect(details).toContainText(courier.name);

    await details.getByRole('button', { name: 'Devolver para a atribuição' }).click();
    const confirm = page.getByRole('dialog', { name: 'Devolver entrega para a atribuição?' });
    await confirm.getByLabel('Motivo').fill('Entregador sem contato há 30 minutos');
    await confirm.getByRole('button', { name: 'Devolver para a atribuição' }).click();

    await expect(confirm).toHaveCount(0);
    await expect(details).toContainText('Não atribuído');
    const history = details.getByRole('region', { name: 'Histórico do pedido' });
    await expect(history).toContainText('Em entrega → Pronto');
    await expect(history).toContainText('Entregador sem contato há 30 minutos');

    // De volta aos prontos, sem entregador; e o entregador está livre para outra entrega.
    await page.goto('/atribuicao');
    const ready = page.getByRole('region', { name: 'Pedidos prontos' }).getByRole('listitem').filter({ hasText: customer });
    await expect(ready).toBeVisible();
    await expect(ready).not.toContainText('Atribuído a');
    await expect(page.getByRole('region', { name: 'Entregadores disponíveis' })).toContainText(courier.name);

    await api.changeStatus(order.id, 'cancelled');
    await api.removeDeliveryPerson(courier.id);
  });
});

