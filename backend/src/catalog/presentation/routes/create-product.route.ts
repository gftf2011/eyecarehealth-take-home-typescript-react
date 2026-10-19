import { errorResponseSchema, type Controller, type Route } from '../../../shared-kernel/presentation';
import { createProductBodySchema, productSchema } from '../schemas/product.schemas';

/** Cadastra um produto (admin). */
export function createProductRoute(controller: Controller): Route {
  return {
    method: 'POST',
    url: '/api/products',
    permission: 'products:write',
    controller,
    docs: {
      summary: 'Cadastrar produto',
      tags: ['Produtos'],
      body: createProductBodySchema,
      responses: {
        201: { description: 'Produto criado', schema: productSchema },
        400: { description: 'Campos inválidos (nome, preço, categoria…), todos de uma vez em `details`', schema: errorResponseSchema },
      },
    },
  };
}
