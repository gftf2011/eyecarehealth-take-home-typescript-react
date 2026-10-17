import { describe, expect, it } from 'vitest';

import { DeliveryPersonAvailability, DeliveryPersonId } from '../..';
import { COURIER_ID } from '../testing/order.fixture';

describe('DeliveryPersonAvailability', () => {
  it.each([
    [true, false, true],
    [false, false, false],
    [true, true, false],
  ])(
    'ativo=%s, em entrega=%s → pode receber pedido? %s',
    (isActive, hasDeliveryInProgress, expected) => {
      const availability = DeliveryPersonAvailability.create({
        deliveryPersonId: DeliveryPersonId.from(COURIER_ID),
        isActive,
        hasDeliveryInProgress,
      });
      expect(availability.canTakeOrder).toBe(expected);
    },
  );
});
