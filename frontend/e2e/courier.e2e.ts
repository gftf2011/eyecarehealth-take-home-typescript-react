import { expect, signIn, test, unique, USERS } from './support/fixtures';

/*
 * O entregador do seed (Carlos Santos) entra com o próprio usuário. O teste
 * conclui a entrega do seed e termina com outra em andamento para ele: o
 * estado volta a ser o do seed (Carlos ocupado), do qual a atribuição depende.
 */
test.describe('Entregador', () => {
  test('entra nas próprias entregas, confirma a entrega e recebe a próxima ao vivo', async ({ page, api }) => {
    await signIn(page, USERS.courier);
    await page.goto('/');

    await expect(page).toHaveURL(/\/minhas-entregas$/);
    await expect(page.getByRole('navigation', { name: 'Principal' }).getByRole('link')).toHaveText(['Minhas entregas']);
    const current = page.getByRole('region', { name: 'Fernando Costa' });
    await expect(current).toContainText('Rua Haddock Lobo, 800');
    await expect(current.getByRole('link', { name: /Ligar para/ })).toHaveAttribute('href', /^tel:\d+$/);
    await expect(page.getByRole('status', { name: /Ao vivo/ })).toBeVisible();

    await current.getByRole('button', { name: 'Confirmar entrega' }).click();
    await page.getByRole('alertdialog', { name: 'Confirmar entrega?' }).getByRole('button', { name: 'Entreguei' }).click();
    await expect(page.getByText('Nenhuma entrega em andamento')).toBeVisible();

    // O gestor despacha um pedido novo para ele: a tela atualiza sem recarregar.
    const customer = unique('Cliente do Carlos');
    const order = await api.placeOrder(customer);
    await api.changeStatus(order.id, 'preparing');
    await api.changeStatus(order.id, 'ready');
    await api.dispatch(order.id, await api.deliveryPersonId('Carlos Santos'));

    await expect(page.getByRole('region', { name: customer })).toBeVisible();
  });

  test('não conseguiu entregar: o gestor vê ao vivo e manda tentar de novo', async ({ page, browser, api }) => {
    // Uma entrega própria do teste para o Carlos (ele termina ocupado, como no seed).
    await signIn(page, USERS.courier);
    await page.goto('/minhas-entregas');
    // A saudação só aparece com os dados carregados: daí dá para saber se há entrega em andamento.
    await expect(page.getByText('Olá, Carlos Santos.')).toBeVisible();
    const confirm = page.getByRole('button', { name: 'Confirmar entrega' });
    if (await confirm.isVisible()) {
      await confirm.click();
      await page.getByRole('alertdialog', { name: 'Confirmar entrega?' }).getByRole('button', { name: 'Entreguei' }).click();
      await expect(page.getByText('Nenhuma entrega em andamento')).toBeVisible();
    }
    const customer = unique('Cliente Ausente');
    const order = await api.placeOrder(customer);
    await api.changeStatus(order.id, 'preparing');
    await api.changeStatus(order.id, 'ready');
    await api.dispatch(order.id, await api.deliveryPersonId('Carlos Santos'));
    const current = page.getByRole('region', { name: customer });
    await expect(current).toBeVisible();

    const managerContext = await browser.newContext();
    const manager = await managerContext.newPage();
    await signIn(manager, USERS.admin);
    await manager.goto('/pedidos?status=delivering');
    await expect(manager.getByRole('status', { name: /Ao vivo/ })).toBeVisible();
    const row = manager.getByRole('listitem').filter({ hasText: customer });
    await expect(row).toBeVisible();

    await current.getByRole('button', { name: 'Não consegui entregar' }).click();
    const report = page.getByRole('dialog', { name: 'Não conseguiu entregar?' });
    await report.getByLabel('Motivo').selectOption('customer_absent');
    await report.getByLabel('Observação (opcional)').fill('Ninguém atende o interfone');
    await report.getByRole('button', { name: 'Relatar problema' }).click();
    await expect(current).toContainText('Problema relatado: Cliente ausente');
    // Parada até o gestor decidir: o entregador não confirma nem relata de novo.
    await expect(current.getByRole('button', { name: 'Confirmar entrega' })).toHaveCount(0);
    await expect(current.getByRole('button', { name: 'Não consegui entregar' })).toHaveCount(0);

    // O gestor vê o problema sem recarregar e decide.
    await expect(row).toContainText('Problema na entrega');
    await row.getByRole('button', { name: `Ver detalhes do pedido de ${customer}` }).click();
    const panel = manager.getByRole('dialog', { name: 'Detalhes do pedido' }).getByRole('region', { name: 'Problemas na entrega' });
    await expect(panel).toContainText('Ninguém atende o interfone');
    await panel.getByRole('button', { name: 'Tentar de novo' }).click();

    // A tela do entregador volta ao normal sozinha.
    await expect(current).not.toContainText('Problema relatado');
    await expect(current.getByRole('button', { name: 'Não consegui entregar' })).toBeVisible();
    await expect(current.getByRole('button', { name: 'Confirmar entrega' })).toBeVisible();
    await managerContext.close();
  });

  test('envia a posição do celular', async ({ page, context }) => {
    await context.grantPermissions(['geolocation']);
    await context.setGeolocation({ latitude: -23.5614, longitude: -46.6559 });
    await signIn(page, USERS.courier);
    await page.goto('/minhas-entregas');

    await page.getByRole('button', { name: 'Atualizar minha localização' }).click();

    await expect(page.getByText('Localização enviada: -23,5614; -46,6559')).toBeVisible();
  });

  test('não abre as telas do painel, e o painel não tem "minhas entregas"', async ({ page }) => {
    await signIn(page, USERS.courier);
    await page.goto('/pedidos');
    await expect(page.getByText('Acesso negado')).toBeVisible();

    await signIn(page, USERS.admin);
    await page.goto('/');
    await expect(page).toHaveURL(/\/pedidos$/);
    await expect(page.getByRole('navigation', { name: 'Principal' }).getByRole('link', { name: 'Minhas entregas' })).toHaveCount(0);
  });
});
