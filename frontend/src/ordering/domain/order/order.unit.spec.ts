import { describe, expect, it } from 'vitest';

import { buildOrder } from './testing/order.fixture';

describe('Order', () => {
  it('oferece as transições do status atual, todas liberadas', () => {
    expect(buildOrder({ status: 'pending' }).transitions()).toEqual([
      { to: 'preparing', blockedBy: null },
      { to: 'cancelled', blockedBy: null },
    ]);
  });

  it('pronto sem entregador: despachar fica bloqueado, cancelar não', () => {
    expect(buildOrder({ status: 'ready', deliveryPerson: null }).transitions()).toEqual([
      { to: 'delivering', blockedBy: 'DELIVERY_PERSON_REQUIRED' },
      { to: 'cancelled', blockedBy: null },
    ]);
  });

  it('pronto com entregador: pode despachar', () => {
    const order = buildOrder({ status: 'ready', deliveryPerson: { id: 'dp-1', name: 'Carlos' } });

    expect(order.transitions()).toContainEqual({ to: 'delivering', blockedBy: null });
  });

  it('pedidos finalizados não têm ações', () => {
    expect(buildOrder({ status: 'delivered' }).transitions()).toEqual([]);
    expect(buildOrder({ status: 'cancelled' }).transitions()).toEqual([]);
  });

  it('conta as unidades de todos os itens', () => {
    expect(buildOrder().itemCount).toBe(3);
  });
});
