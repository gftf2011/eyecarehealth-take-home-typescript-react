import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { resetDatabase } from '../../shared-kernel/infra/database/testing/test-database';
import {
  ADMIN_TOKEN,
  bearer,
  EXPIRED_TOKEN,
  VIEWER_TOKEN,
} from '../../shared-kernel/presentation/testing/static-authenticator';
import { buildTestApp, type TestApp } from '../../main/http/testing/build-test-app';

const juice = {
  name: 'Suco de Laranja Natural',
  description: 'Suco de laranja natural, feito na hora, 500ml',
  price: 12.5,
  category: 'drink',
  imageUrl: 'https://example.com/suco.jpg',
  preparationTime: 5,
};

describe('API de produtos (/api/products)', () => {
  let testApp: TestApp;

  beforeAll(async () => {
    testApp = await buildTestApp();
  });

  beforeEach(async () => {
    await resetDatabase(testApp.db);
  });

  afterAll(async () => {
    await testApp.close();
  });

  async function createProduct(payload: object = juice) {
    return testApp.app.inject({
      method: 'POST',
      url: '/api/products',
      headers: bearer(ADMIN_TOKEN),
      payload,
    });
  }

  describe('autenticação e autorização', () => {
    it('401 INVALID_TOKEN sem token', async () => {
      const response = await testApp.app.inject({ method: 'GET', url: '/api/products' });

      expect(response.statusCode).toBe(401);
      expect(response.json()).toEqual({
        error: { code: 'INVALID_TOKEN', message: 'Token de acesso ausente ou inválido' },
      });
    });

    it('401 TOKEN_EXPIRED com token expirado', async () => {
      const response = await testApp.app.inject({
        method: 'GET',
        url: '/api/products',
        headers: bearer(EXPIRED_TOKEN),
      });

      expect(response.statusCode).toBe(401);
      expect(response.json().error.code).toBe('TOKEN_EXPIRED');
    });

    it('viewer lê, mas não escreve (403 FORBIDDEN)', async () => {
      const list = await testApp.app.inject({
        method: 'GET',
        url: '/api/products',
        headers: bearer(VIEWER_TOKEN),
      });
      const create = await testApp.app.inject({
        method: 'POST',
        url: '/api/products',
        headers: bearer(VIEWER_TOKEN),
        payload: juice,
      });

      expect(list.statusCode).toBe(200);
      expect(create.statusCode).toBe(403);
      expect(create.json().error.code).toBe('FORBIDDEN');
    });
  });

  describe('POST /api/products', () => {
    it('201 com o produto criado', async () => {
      const response = await createProduct();

      expect(response.statusCode).toBe(201);
      expect(response.json()).toEqual({
        id: expect.stringMatching(/^[0-9a-f-]{36}$/),
        ...juice,
        isAvailable: true,
        createdAt: '2025-02-01T12:00:00.000Z',
        updatedAt: '2025-02-01T12:00:00.000Z',
      });
    });

    it('400 VALIDATION_ERROR listando cada campo inválido', async () => {
      const response = await createProduct({ ...juice, name: 'ab', price: 0, category: 'pizza' });

      expect(response.statusCode).toBe(400);
      expect(response.json()).toEqual({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Dados inválidos',
          details: [
            { field: 'name', message: 'O nome deve ter entre 3 e 120 caracteres' },
            { field: 'price', message: 'O preço deve ser maior que zero' },
            { field: 'category', message: 'A categoria deve ser uma de: meal, drink, dessert, side' },
          ],
        },
      });
    });

    it('400 quando o tipo do campo está errado', async () => {
      const response = await createProduct({ ...juice, price: '12.50' });

      expect(response.statusCode).toBe(400);
      expect(response.json().error.details).toEqual([
        expect.objectContaining({ field: 'price' }),
      ]);
    });

    it('400 para JSON malformado', async () => {
      const response = await testApp.app.inject({
        method: 'POST',
        url: '/api/products',
        headers: { ...bearer(ADMIN_TOKEN), 'content-type': 'application/json' },
        payload: '{"name": ',
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('GET /api/products/:id', () => {
    it('200 com o produto', async () => {
      const { id } = (await createProduct()).json();

      const response = await testApp.app.inject({
        method: 'GET',
        url: `/api/products/${id}`,
        headers: bearer(VIEWER_TOKEN),
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().name).toBe(juice.name);
    });

    it('404 PRODUCT_NOT_FOUND', async () => {
      const response = await testApp.app.inject({
        method: 'GET',
        url: '/api/products/00000000-0000-4000-8000-000000000000',
        headers: bearer(ADMIN_TOKEN),
      });

      expect(response.statusCode).toBe(404);
      expect(response.json().error).toMatchObject({
        code: 'PRODUCT_NOT_FOUND',
        message: 'Produto não encontrado',
      });
    });

    it('400 para ID que não é UUID', async () => {
      const response = await testApp.app.inject({
        method: 'GET',
        url: '/api/products/abc',
        headers: bearer(ADMIN_TOKEN),
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().error.details[0].field).toBe('productId');
    });
  });

  describe('GET /api/products', () => {
    it('lista com paginação, busca e filtros vindos da query string', async () => {
      await createProduct();
      await createProduct({ ...juice, name: 'Suco de Uva', isAvailable: false });
      await createProduct({ ...juice, name: 'X-Burger Especial', category: 'meal', price: 32.9 });

      const response = await testApp.app.inject({
        method: 'GET',
        url: '/api/products?search=suco&isAvailable=true&limit=1&sortBy=name&sortOrder=asc',
        headers: bearer(VIEWER_TOKEN),
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.data.map((product: { name: string }) => product.name)).toEqual([
        'Suco de Laranja Natural',
      ]);
      expect(body.pagination).toEqual({ limit: 1, nextCursor: null, previousCursor: null });
    });

    it('400 para limite acima de 100', async () => {
      const response = await testApp.app.inject({
        method: 'GET',
        url: '/api/products?limit=101',
        headers: bearer(ADMIN_TOKEN),
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().error.details[0].field).toBe('limit');
    });
  });

  describe('PUT /api/products/:id', () => {
    it('200 com o produto atualizado parcialmente', async () => {
      const { id } = (await createProduct()).json();
      testApp.clock.advanceBy(60_000);

      const response = await testApp.app.inject({
        method: 'PUT',
        url: `/api/products/${id}`,
        headers: bearer(ADMIN_TOKEN),
        payload: { price: 13.9, isAvailable: false },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        name: juice.name,
        price: 13.9,
        isAvailable: false,
        updatedAt: '2025-02-01T12:01:00.000Z',
      });
    });
  });

  describe('DELETE /api/products/:id', () => {
    it('204 e o produto deixa de existir para a API', async () => {
      const { id } = (await createProduct()).json();

      const removed = await testApp.app.inject({
        method: 'DELETE',
        url: `/api/products/${id}`,
        headers: bearer(ADMIN_TOKEN),
      });
      const fetched = await testApp.app.inject({
        method: 'GET',
        url: `/api/products/${id}`,
        headers: bearer(ADMIN_TOKEN),
      });

      expect(removed.statusCode).toBe(204);
      expect(removed.body).toBe('');
      expect(fetched.statusCode).toBe(404);
    });
  });
});
