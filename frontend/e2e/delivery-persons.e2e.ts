import { expect, signIn, test, unique, USERS } from './support/fixtures';

/*
 * Cada teste cria os próprios entregadores e os remove no fim: um entregador
 * livre a mais mudaria a sugestão de atribuição dos outros testes.
 */
test.describe('Entregadores', () => {
  test('cadastra, edita, desativa e exclui um entregador pela tela', async ({ page }) => {
    await signIn(page);
    const name = unique('Entregador Tela');
    await page.goto('/entregadores');

    await page.getByRole('button', { name: 'Novo entregador' }).click();
    const form = page.getByRole('dialog', { name: 'Novo entregador' });
    await form.getByLabel('Nome').fill(name);
    await form.getByLabel('Telefone').fill('(11) 96666-5555');
    await form.getByLabel('Veículo').selectOption('bicycle');
    await form.getByLabel('Latitude').fill('-23,5614');
    await form.getByLabel('Longitude').fill('-46,6559');
    await form.getByRole('button', { name: 'Cadastrar entregador' }).click();

    const row = page.getByRole('row').filter({ has: page.getByRole('rowheader', { name: new RegExp(name) }) });
    await expect(row).toContainText('Bicicleta');
    await expect(row).toContainText('Livre');
    await expect(row).toContainText('-23,5614; -46,6559');

    await row.getByRole('button', { name: `Editar ${name}` }).click();
    const edit = page.getByRole('dialog', { name: `Editar ${name}` });
    await edit.getByLabel('Veículo').selectOption('car');
    await edit.getByRole('button', { name: 'Salvar alterações' }).click();
    await expect(row).toContainText('Carro');

    await row.getByRole('switch', { name: `Ativo: ${name}` }).click();
    await expect(row).toContainText('Inativo');
    await page.reload();
    await expect(row.getByRole('switch', { name: `Ativo: ${name}` })).not.toBeChecked();

    await row.getByRole('button', { name: `Excluir ${name}` }).click();
    await page.getByRole('alertdialog', { name: 'Excluir entregador?' }).getByRole('button', { name: 'Excluir entregador' }).click();
    await expect(row).toHaveCount(0);
  });

  test('quem está em entrega não pode ser excluído: o painel explica', async ({ page, api }) => {
    const courier = await api.registerDeliveryPerson(unique('Entregador Ocupado'));
    const order = await api.placeOrder(unique('Cliente Entrega'));
    await api.changeStatus(order.id, 'preparing');
    await api.changeStatus(order.id, 'ready');
    await api.dispatch(order.id, courier.id);
    await signIn(page);
    await page.goto('/entregadores?available=false');

    const row = page.getByRole('row').filter({ has: page.getByRole('rowheader', { name: new RegExp(courier.name) }) });
    await expect(row).toContainText('Em entrega');
    await row.getByRole('button', { name: `Excluir ${courier.name}` }).click();
    const dialog = page.getByRole('alertdialog', { name: 'Excluir entregador?' });
    await dialog.getByRole('button', { name: 'Excluir entregador' }).click();

    await expect(dialog.getByRole('alert')).toContainText('Espere a entrega terminar ou desative-o');

    await api.changeStatus(order.id, 'delivered');
    await api.removeDeliveryPerson(courier.id);
  });

  test('a lista atualiza sozinha quando outro gestor cadastra um entregador', async ({ page, api }) => {
    await signIn(page);
    await page.goto('/entregadores');
    await expect(page.getByRole('status', { name: /Ao vivo/ })).toBeVisible();

    const courier = await api.registerDeliveryPerson(unique('Entregador Ao Vivo'));

    // Sem reload: outbox → relay → SNS → SQS → gateway → WebSocket.
    await expect(page.getByRole('rowheader', { name: new RegExp(courier.name) })).toBeVisible();
    await api.removeDeliveryPerson(courier.id);
    await expect(page.getByRole('rowheader', { name: new RegExp(courier.name) })).toHaveCount(0);
  });

  test('perfil somente leitura não tem a tela de entregadores', async ({ page }) => {
    await signIn(page, USERS.viewer);
    await page.goto('/entregadores');

    await expect(page.getByText('Acesso negado')).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Principal' }).getByRole('link', { name: 'Entregadores' })).toHaveCount(0);
  });
});
