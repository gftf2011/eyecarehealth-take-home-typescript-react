import { describe, expect, it } from 'vitest';

import { parseSeedData } from './seed-data';

const product = {
  name: 'X-Burger Especial',
  description: 'Hamburguer artesanal com queijo cheddar',
  price: 32.9,
  category: 'meal',
  preparationTime: 25,
};
const courier = { name: 'Carlos Santos', phone: '(11) 91234-5678', vehicleType: 'motorcycle' };
const order = {
  customerName: 'Joao Silva',
  customerPhone: '(11) 99999-1234',
  deliveryAddress: 'Rua das Flores, 123, São Paulo - SP',
  latitude: -23.58,
  longitude: -46.63,
  status: 'pending',
  items: [{ productIndex: 0, quantity: 2 }],
};
const valid = {
  users: [{ email: 'admin@fastmeals.com', password: 'Admin@123', role: 'admin' }],
  products: [product],
  deliveryPersons: [courier],
  orders: [order],
};

describe('parseSeedData', () => {
  it('aceita o formato do arquivo e aplica os padrões', () => {
    const data = parseSeedData(valid);

    expect(data.products[0]?.isAvailable).toBe(true);
    expect(data.deliveryPersons[0]?.isActive).toBe(true);
  });

  it('aponta referências por índice inexistentes, com o caminho de cada uma', () => {
    const broken = {
      ...valid,
      orders: [
        order,
        { ...order, status: 'delivered', deliveryPersonIndex: 7, items: [{ productIndex: 3, quantity: 1 }] },
        { ...order, status: 'delivering' },
      ],
    };

    expect(() => parseSeedData(broken)).toThrow(
      [
        'seed/data.json inválido:',
        '- orders[1].items[0].productIndex: Produto 3 não existe (há 1)',
        '- orders[1].deliveryPersonIndex: Entregador 7 não existe (há 1)',
        "- orders[2].deliveryPersonIndex: Pedido 'delivering' precisa de deliveryPersonIndex",
      ].join('\n'),
    );
  });

  it('rejeita status desconhecido e campos ausentes', () => {
    expect(() => parseSeedData({ ...valid, orders: [{ ...order, status: 'shipped' }] })).toThrow(/orders\[0\]\.status/);
    expect(() => parseSeedData({ ...valid, users: [] })).toThrow(/users/);
  });
});
