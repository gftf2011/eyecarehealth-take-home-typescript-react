import { expect, signIn, test, USERS } from './support/fixtures';

test.describe('Relatórios', () => {
  test('mostra as quatro métricas do período com os dados do seed', async ({ page }) => {
    await signIn(page, USERS.viewer);
    await page.goto('/relatorios');

    await expect(page.getByRole('heading', { name: 'Relatórios' })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Receita por dia' }).getByRole('table')).toBeVisible();
    await expect(page.getByRole('list', { name: 'Pedidos por status' })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Produtos mais vendidos' })).toBeVisible();
    // O seed tem pedidos entregues nas últimas duas semanas: a receita não é zero.
    await expect(page.getByRole('term').filter({ hasText: 'Pedidos entregues' })).toBeVisible();
  });

  test('trocar o período atualiza a URL e recarrega os números', async ({ page }) => {
    await signIn(page, USERS.viewer);
    await page.goto('/relatorios');
    await expect(page.getByRole('heading', { name: 'Relatórios' })).toBeVisible();

    await page.getByRole('button', { name: 'Últimos 7 dias' }).click();

    await expect(page).toHaveURL(/startDate=\d{4}-\d{2}-\d{2}/);
    await expect(page.getByRole('region', { name: 'Receita por dia' }).getByRole('table')).toBeVisible();
  });
});
