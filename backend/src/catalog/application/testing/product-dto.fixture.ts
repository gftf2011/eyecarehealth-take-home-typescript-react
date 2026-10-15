import type { ProductDto } from '../dtos/product.dto';

export const BURGER_DTO: ProductDto = {
  id: '3f2b8c1e-6a4d-4e8f-9b1a-0c2d3e4f5a6b',
  name: 'X-Burger Especial',
  description: 'Hamburguer artesanal com queijo cheddar e bacon',
  price: 32.9,
  category: 'meal',
  imageUrl: 'https://example.com/burger.jpg',
  isAvailable: true,
  preparationTime: 25,
  createdAt: new Date('2025-01-15T10:30:00Z'),
  updatedAt: new Date('2025-01-15T10:30:00Z'),
};

export function productDto(overrides: Partial<ProductDto> = {}): ProductDto {
  return { ...BURGER_DTO, ...overrides };
}
