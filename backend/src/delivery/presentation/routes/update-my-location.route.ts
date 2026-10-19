import { errorResponseSchema, type Controller, type Route } from '../../../shared-kernel/presentation';
import { deliveryPersonSchema, myLocationBodySchema } from '../schemas/delivery.schemas';

/** O entregador logado atualiza a própria localização. */
export function updateMyLocationRoute(controller: Controller): Route {
  return {
    method: 'PUT',
    url: '/api/me/location',
    permission: 'my-deliveries:write',
    controller,
    docs: {
      summary: 'Atualizar minha localização',
      description:
        'O entregador vem do usuário do token (nunca do corpo): cada um só altera a si mesmo. A posição entra na próxima sugestão de atribuição.',
      tags: ['Minhas entregas'],
      body: myLocationBodySchema,
      responses: {
        200: { description: 'Entregador com a nova localização', schema: deliveryPersonSchema },
        404: { description: 'O usuário não é o login de nenhum entregador (`DELIVERY_PERSON_NOT_LINKED`)', schema: errorResponseSchema },
      },
    },
  };
}
