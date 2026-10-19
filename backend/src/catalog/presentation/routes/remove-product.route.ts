import { errorResponseSchema, idParams, type Controller, type Route } from '../../../shared-kernel/presentation';

/** Remove um produto do cardápio (soft delete). */
export function removeProductRoute(controller: Controller): Route {
  return {
    method: 'DELETE',
    url: '/api/products/:id',
    permission: 'products:write',
    controller,
    docs: {
      summary: 'Remover produto',
      description: 'Soft delete: some das listagens, mas os pedidos antigos continuam mostrando o produto.',
      tags: ['Produtos'],
      params: idParams,
      responses: {
        204: { description: 'Removido' },
        404: { description: 'Produto não existe ou já foi removido (`PRODUCT_NOT_FOUND`)', schema: errorResponseSchema },
        409: { description: 'Produto em pedidos em andamento (`PRODUCT_IN_USE`)', schema: errorResponseSchema },
      },
    },
  };
}
