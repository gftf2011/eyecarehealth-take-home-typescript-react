import { describe, expect, it } from 'vitest';

import { InputValidationError } from '../../../../shared-kernel/application';
import { EMPTY_DELIVERY_PERSON_FORM } from '../../inputs/delivery-person-form.input';
import { FakeDeliveryPersonGateway } from '../../testing/fake-delivery-person.gateway';
import { RegisterDeliveryPersonUseCase } from './register-delivery-person.usecase';

describe('RegisterDeliveryPersonUseCase', () => {
  it('envia os dados validados e devolve o entregador cadastrado', async () => {
    const gateway = new FakeDeliveryPersonGateway();

    const registered = await new RegisterDeliveryPersonUseCase(gateway).execute({
      name: 'Ana Ferreira',
      phone: '(11) 98765-4321',
      vehicleType: 'bicycle',
      currentLatitude: '',
      currentLongitude: '',
      isActive: true,
    });

    expect(gateway.registered).toHaveLength(1);
    expect(gateway.registered[0]?.location).toBeNull();
    expect(registered).toMatchObject({ id: 'courier-new', name: 'Ana Ferreira', isOnDelivery: false, latitude: null });
  });

  it('dados inválidos não chegam à API', async () => {
    const gateway = new FakeDeliveryPersonGateway();

    await expect(new RegisterDeliveryPersonUseCase(gateway).execute(EMPTY_DELIVERY_PERSON_FORM)).rejects.toThrow(
      InputValidationError,
    );
    expect(gateway.registered).toEqual([]);
  });
});
