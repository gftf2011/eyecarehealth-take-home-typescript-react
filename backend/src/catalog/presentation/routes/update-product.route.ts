import { errorResponseSchema, idParams, type Controller, type Route } from '../../../shared-kernel/presentation';
import { productSchema, updateProductBodySchema } from '../schemas/product.schemas';

/** Atualiza um produto: dados, preço ou disponibilidade. */
export function updateProductRoute(controller: Controller): Route {
  return {
    method: 'PUT',
    url: '/api/products/:id',
    permission: 'products:write',
    controller,
    docs: {
      summary: 'Atualizar produto',
      description: 'Atualização parcial: só os campos enviados mudam. Também liga e desliga a disponibilidade (`isAvailable`).',
      tags: ['Produtos'],
      params: idParams,
      body: updateProductBodySchema,
      responses: {
        200: { description: 'Produto atualizado', schema: productSchema },
        404: { description: 'Produto não existe ou foi removido (`PRODUCT_NOT_FOUND`)', schema: errorResponseSchema },
      },
    },
  };
}
