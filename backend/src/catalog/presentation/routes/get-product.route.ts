import { errorResponseSchema, idParams, type Controller, type Route } from '../../../shared-kernel/presentation';
import { productSchema } from '../schemas/product.schemas';

/** Detalhe de um produto (inclusive indisponível). */
export function getProductRoute(controller: Controller): Route {
  return {
    method: 'GET',
    url: '/api/products/:id',
    permission: 'products:read',
    controller,
    docs: {
      summary: 'Detalhar produto',
      tags: ['Produtos'],
      params: idParams,
      responses: {
        200: { description: 'O produto', schema: productSchema },
        404: { description: 'Produto não existe ou foi removido (`PRODUCT_NOT_FOUND`)', schema: errorResponseSchema },
      },
    },
  };
}
