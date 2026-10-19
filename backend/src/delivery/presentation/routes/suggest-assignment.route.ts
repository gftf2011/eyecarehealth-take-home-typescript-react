import { errorResponseSchema, type Controller, type Route } from '../../../shared-kernel/presentation';
import { assignmentSuggestionSchema } from '../schemas/delivery.schemas';

/** Sugere a atribuição pedido → entregador de menor distância total. */
export function suggestAssignmentRoute(controller: Controller): Route {
  return {
    method: 'POST',
    url: '/api/orders/optimize-assignment',
    permission: 'orders:write',
    controller,
    docs: {
      summary: 'Sugerir atribuição otimizada',
      description:
        'Algoritmo Húngaro sobre a matriz de distâncias Haversine entre os pedidos `ready` e os entregadores ativos e livres: minimiza a distância total. **Só sugere**: nada muda até cada par ser aceito em `POST /api/orders/{id}/dispatch`. Problemas grandes rodam num pool de workers, sem travar a API.',
      tags: ['Atribuição'],
      responses: {
        200: { description: 'Pares sugeridos, pedidos sem entregador e entregadores sem localização', schema: assignmentSuggestionSchema },
        503: {
          description: 'Otimizador ocupado (`OPTIMIZER_BUSY`) ou cálculo acima do tempo limite (`OPTIMIZER_TIMEOUT`); tente de novo',
          schema: errorResponseSchema,
        },
      },
    },
  };
}
