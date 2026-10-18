import type { ProductCategoryValue } from '../../domain';

export const CATEGORY_LABELS: Readonly<Record<ProductCategoryValue, string>> = {
  meal: 'Refeição',
  drink: 'Bebida',
  dessert: 'Sobremesa',
  side: 'Acompanhamento',
};

export const PRODUCT_SORT_OPTIONS = [
  { value: 'createdAt:desc', label: 'Mais recentes' },
  { value: 'name:asc', label: 'Nome (A–Z)' },
  { value: 'name:desc', label: 'Nome (Z–A)' },
  { value: 'price:asc', label: 'Menor preço' },
  { value: 'price:desc', label: 'Maior preço' },
] as const;
