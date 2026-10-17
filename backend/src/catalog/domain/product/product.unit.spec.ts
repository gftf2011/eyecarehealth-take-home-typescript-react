import { describe, expect, it } from 'vitest';

import {
  ImageUrl,
  Product,
  ProductAlreadyRemovedError,
  ProductAvailabilityChanged,
  ProductCreated,
  ProductInUseError,
  ProductName,
  ProductPrice,
  ProductPriceChanged,
  ProductRemoved,
  ProductUpdated,
} from '..';
import { buildCreateProductParams, buildProduct, CREATED_AT, LATER } from './testing/product.fixture';

describe('Product', () => {
  describe('create', () => {
    it('nasce disponível por padrão, com timestamps e evento ProductCreated', () => {
      const params = buildCreateProductParams();

      const product = Product.create(params);

      expect(product.isAvailable).toBe(true);
      expect(product.isOrderable).toBe(true);
      expect(product.createdAt).toEqual(CREATED_AT);
      expect(product.updatedAt).toEqual(CREATED_AT);
      expect(product.removedAt).toBeNull();

      const events = product.pullDomainEvents();
      expect(events).toHaveLength(1);
      expect(events[0]).toBeInstanceOf(ProductCreated);
      expect(events[0]?.payload).toEqual({
        name: 'X-Burger Especial',
        priceCents: 3290,
        category: 'meal',
        isAvailable: true,
      });
    });

    it('respeita isAvailable explícito', () => {
      const product = Product.create(buildCreateProductParams({ isAvailable: false }));
      expect(product.isAvailable).toBe(false);
      expect(product.isOrderable).toBe(false);
    });

    it('não compartilha a referência de data recebida', () => {
      const now = new Date(CREATED_AT.getTime());
      const product = Product.create(buildCreateProductParams({ now }));

      now.setFullYear(2000);
      product.createdAt.setFullYear(1999);

      expect(product.createdAt).toEqual(CREATED_AT);
    });
  });

  describe('reconstitute', () => {
    it('reidrata o estado sem emitir eventos', () => {
      const original = buildProduct();

      const restored = Product.reconstitute(original.id, original.snapshot());

      expect(restored.equals(original)).toBe(true);
      expect(restored.snapshot()).toEqual(original.snapshot());
      expect(restored.domainEvents).toHaveLength(0);
    });
  });

  describe('updateDetails', () => {
    it('aplica só os campos alterados e emite ProductUpdated', () => {
      const product = buildProduct();

      product.updateDetails({ name: ProductName.create('X-Burger Duplo') }, LATER);

      expect(product.name.value).toBe('X-Burger Duplo');
      expect(product.price.toDecimal()).toBe(32.9);
      expect(product.updatedAt).toEqual(LATER);

      const events = product.pullDomainEvents();
      expect(events).toHaveLength(1);
      expect(events[0]).toBeInstanceOf(ProductUpdated);
      expect(events[0]?.payload).toEqual({ changedFields: ['name'] });
    });

    it('emite ProductPriceChanged quando o preço muda', () => {
      const product = buildProduct();

      product.updateDetails({ price: ProductPrice.fromDecimal(35) }, LATER);

      const events = product.pullDomainEvents();
      expect(events.map((event) => event.constructor)).toEqual([ProductUpdated, ProductPriceChanged]);
      expect(events[1]?.payload).toEqual({ previousPriceCents: 3290, newPriceCents: 3500 });
    });

    it('permite remover a imagem com imageUrl null', () => {
      const product = buildProduct();

      product.updateDetails({ imageUrl: null }, LATER);

      expect(product.imageUrl).toBeNull();
      expect(product.pullDomainEvents()[0]?.payload).toEqual({ changedFields: ['imageUrl'] });
    });

    it('é no-op quando os valores são iguais aos atuais', () => {
      const product = buildProduct();

      product.updateDetails(
        {
          name: ProductName.create('X-Burger Especial'),
          price: ProductPrice.fromDecimal(32.9),
          imageUrl: ImageUrl.create('https://example.com/burger.jpg'),
        },
        LATER,
      );

      expect(product.updatedAt).toEqual(CREATED_AT);
      expect(product.domainEvents).toHaveLength(0);
    });
  });

  describe('disponibilidade', () => {
    it('desativa e reativa emitindo ProductAvailabilityChanged', () => {
      const product = buildProduct();

      product.makeUnavailable(LATER);
      expect(product.isAvailable).toBe(false);
      expect(product.isOrderable).toBe(false);

      product.makeAvailable(LATER);
      expect(product.isAvailable).toBe(true);

      const payloads = product.pullDomainEvents().map((event) => {
        expect(event).toBeInstanceOf(ProductAvailabilityChanged);
        return event.payload;
      });
      expect(payloads).toEqual([{ isAvailable: false }, { isAvailable: true }]);
    });

    it('é idempotente: não emite evento quando o estado não muda', () => {
      const product = buildProduct();

      product.makeAvailable(LATER);

      expect(product.updatedAt).toEqual(CREATED_AT);
      expect(product.domainEvents).toHaveLength(0);
    });
  });

  describe('remove', () => {
    it('faz soft delete e emite ProductRemoved', () => {
      const product = buildProduct();

      product.remove({ hasActiveOrders: false, now: LATER });

      expect(product.isRemoved).toBe(true);
      expect(product.removedAt).toEqual(LATER);
      expect(product.isOrderable).toBe(false);
      expect(product.pullDomainEvents()[0]).toBeInstanceOf(ProductRemoved);
    });

    it('não remove produto vinculado a pedidos pending/preparing', () => {
      const product = buildProduct();

      expect(() => product.remove({ hasActiveOrders: true, now: LATER })).toThrow(ProductInUseError);
      expect(product.isRemoved).toBe(false);
      expect(product.domainEvents).toHaveLength(0);
    });

    it.each([
      ['updateDetails', (product: Product) => product.updateDetails({ imageUrl: null }, LATER)],
      ['makeUnavailable', (product: Product) => product.makeUnavailable(LATER)],
      ['makeAvailable', (product: Product) => product.makeAvailable(LATER)],
      ['remove', (product: Product) => product.remove({ hasActiveOrders: false, now: LATER })],
    ])('produto removido rejeita %s', (_operation, act) => {
      const product = buildProduct();
      product.remove({ hasActiveOrders: false, now: LATER });
      product.pullDomainEvents();

      expect(() => act(product)).toThrow(ProductAlreadyRemovedError);
      expect(product.domainEvents).toHaveLength(0);
    });
  });
});
