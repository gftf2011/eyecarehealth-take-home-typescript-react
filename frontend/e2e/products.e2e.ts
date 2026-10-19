import { expect, signIn, test, unique } from './support/fixtures';

test.describe('Produtos', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
  });

  test('lista o cardápio do seed com categoria, preço e disponibilidade', async ({ page }) => {
    // Pela busca: os outros testes criam produtos (os pedidos também), e a
    // primeira página, dos mais recentes, deixa de mostrar o seed.
    await page.goto('/produtos?search=X-Burger');

    const burger = page.getByRole('row', { name: /X-Burger Especial/ });
    await expect(burger).toContainText('Refeição');
    await expect(burger).toContainText(/R\$\s?32,90/);
    await expect(burger.getByRole('switch', { name: 'Disponível: X-Burger Especial' })).toBeChecked();
  });

  test('cria um produto com validação em tempo real', async ({ page }) => {
    const name = unique('Batata Rústica');
    await page.goto('/produtos');
    await page.getByRole('button', { name: 'Novo produto' }).click();
    const dialog = page.getByRole('dialog', { name: 'Novo produto' });

    // Preço inválido: a mensagem aparece antes de enviar.
    await dialog.getByLabel('Preço (R$)').fill('0');
    await dialog.getByLabel('Preço (R$)').blur();
    await expect(dialog.getByText(/preço deve ser maior que zero/i)).toBeVisible();

    await dialog.getByLabel('Nome').fill(name);
    await dialog.getByLabel('Descrição').fill('Batatas rústicas com alecrim e páprica');
    await dialog.getByLabel('Preço (R$)').fill('18,90');
    await dialog.getByLabel('Categoria').selectOption('side');
    await dialog.getByLabel('Preparo (min)').fill('12');
    await dialog.getByRole('button', { name: 'Criar produto' }).click();

    await expect(dialog).toBeHidden();
    const row = page.getByRole('row', { name: new RegExp(name) });
    await expect(row).toContainText('Acompanhamento');
    await expect(row).toContainText(/R\$\s?18,90/);
  });

  test('busca por nome enquanto digita, com o filtro na URL', async ({ page, api }) => {
    const name = unique('Torta Holandesa');
    await api.createProduct({ name, category: 'dessert' });
    await page.goto('/produtos');

    await page.getByLabel('Buscar por nome').fill('torta holandesa');

    await expect(page.getByRole('row', { name: new RegExp(name) })).toBeVisible();
    await expect(page.getByRole('row', { name: /X-Burger Especial/ })).toHaveCount(0);
    await expect(page).toHaveURL(/search=torta/);
  });

  test('edita o preço a partir dos dados atuais', async ({ page, api }) => {
    const product = await api.createProduct({ name: unique('Suco de Caju'), price: 9.5, category: 'drink' });
    await page.goto('/produtos');

    await page.getByRole('button', { name: `Editar ${product.name}` }).click();
    const dialog = page.getByRole('dialog', { name: `Editar ${product.name}` });
    await expect(dialog.getByLabel('Preço (R$)')).toHaveValue('9,50');
    await dialog.getByLabel('Preço (R$)').fill('11,90');
    await dialog.getByRole('button', { name: 'Salvar alterações' }).click();

    await expect(dialog).toBeHidden();
    await expect(page.getByRole('row', { name: new RegExp(product.name) })).toContainText(/R\$\s?11,90/);
  });

  test('pausar um produto persiste depois do reload', async ({ page, api }) => {
    const product = await api.createProduct({ name: unique('Wrap Vegano') });
    await page.goto('/produtos');
    const toggle = page.getByRole('switch', { name: `Disponível: ${product.name}` });

    await toggle.click();
    await expect(toggle).not.toBeChecked();

    await page.reload();
    await expect(page.getByRole('switch', { name: `Disponível: ${product.name}` })).not.toBeChecked();
  });

  test('exclui um produto depois de confirmar', async ({ page, api }) => {
    const product = await api.createProduct({ name: unique('Quiche de Alho-poró') });
    await page.goto('/produtos');

    await page.getByRole('button', { name: `Excluir ${product.name}` }).click();
    const confirm = page.getByRole('alertdialog', { name: 'Excluir produto?' });
    await confirm.getByRole('button', { name: 'Excluir produto' }).click();

    await expect(confirm).toBeHidden();
    await expect(page.getByRole('row', { name: new RegExp(product.name) })).toHaveCount(0);
  });
});
