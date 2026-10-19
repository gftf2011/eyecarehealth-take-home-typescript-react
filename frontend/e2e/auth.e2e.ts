import { expect, signIn, test, USERS } from './support/fixtures';

test.describe('Autenticação', () => {
  test('login inválido mostra o erro e continua na tela de login', async ({ page }) => {
    await page.goto('/login');

    await page.getByLabel('Email').fill(USERS.admin.email);
    await page.getByLabel('Senha').fill('senha-errada');
    await page.getByRole('button', { name: 'Entrar' }).click();

    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test('login válido abre o painel de pedidos; sair volta ao login e fecha a sessão', async ({ page }) => {
    await page.goto('/login');

    await page.getByLabel('Email').fill(USERS.admin.email);
    await page.getByLabel('Senha').fill(USERS.admin.password);
    await page.getByRole('button', { name: 'Entrar' }).click();

    await expect(page.getByRole('heading', { name: 'Pedidos' })).toBeVisible();
    await page.getByRole('button', { name: 'Sair' }).click();
    await expect(page).toHaveURL(/\/login/);

    // A sessão acabou no servidor: voltar para uma tela protegida pede login de novo.
    await page.goto('/pedidos');
    await expect(page).toHaveURL(/\/login/);
  });

  test('tela protegida sem sessão vai para o login e, depois de entrar, volta para ela', async ({ page }) => {
    await page.goto('/produtos');
    await expect(page).toHaveURL(/\/login/);

    await page.getByLabel('Email').fill(USERS.admin.email);
    await page.getByLabel('Senha').fill(USERS.admin.password);
    await page.getByRole('button', { name: 'Entrar' }).click();

    await expect(page).toHaveURL(/\/produtos/);
    await expect(page.getByRole('heading', { name: 'Produtos' })).toBeVisible();
  });

  test('a sessão sobrevive a um reload (refresh token em cookie httpOnly)', async ({ page, context }) => {
    await signIn(page);
    await page.goto('/pedidos');
    await expect(page.getByRole('heading', { name: 'Pedidos' })).toBeVisible();

    await page.reload();

    await expect(page.getByRole('heading', { name: 'Pedidos' })).toBeVisible();
    // O token nunca fica acessível ao JavaScript da página.
    const cookies = await context.cookies();
    expect(cookies.length).toBeGreaterThan(0);
    expect(cookies.every((cookie) => cookie.httpOnly)).toBe(true);
    expect(await page.evaluate(() => document.cookie)).toBe('');
    expect(await page.evaluate(() => JSON.stringify(localStorage) + JSON.stringify(sessionStorage))).not.toMatch(/eyJ/);
  });

  test('perfil somente leitura não vê ações de escrita', async ({ page }) => {
    await signIn(page, USERS.viewer);
    await page.goto('/produtos');

    await expect(page.getByRole('heading', { name: 'Produtos' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Novo produto' })).toHaveCount(0);
    await expect(page.getByRole('switch')).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Atribuição' })).toHaveCount(0);
  });
});
