import { collectFieldErrors, validateInput } from '../../../shared-kernel/application';
import {
  ImageUrl,
  InvalidPreparationTimeError,
  InvalidProductCategoryError,
  InvalidProductPriceError,
  PreparationTime,
  ProductCategory,
  ProductDescription,
  ProductName,
  ProductPrice,
  type ProductDetails,
} from '../../domain';
import type { ProductDto } from '../dtos/product.dto';

/**
 * Campos do formulário como o usuário digita (texto). Os nomes são os da
 * API, então um erro por campo vindo do servidor cai no campo certo.
 */
export type ProductFormInput = {
  readonly name: string;
  readonly description: string;
  /** Aceita vírgula ou ponto decimal (`32,90`). */
  readonly price: string;
  readonly category: string;
  /** Vazio = sem imagem. */
  readonly imageUrl: string;
  readonly preparationTime: string;
  readonly isAvailable: boolean;
};

export type ProductFormField = Exclude<keyof ProductFormInput, 'isAvailable'>;

export const EMPTY_PRODUCT_FORM: ProductFormInput = {
  name: '',
  description: '',
  price: '',
  category: '',
  imageUrl: '',
  preparationTime: '',
  isAvailable: true,
};

/** Valida todos os campos de uma vez com as regras da API (Value Objects). */
export function parseProductFormInput(input: ProductFormInput): ProductDetails {
  return validateInput({
    name: () => ProductName.create(input.name),
    description: () => ProductDescription.create(input.description),
    price: () => ProductPrice.fromDecimal(parsePrice(input.price)),
    category: () => {
      if (input.category.trim() === '') throw new InvalidProductCategoryError('Escolha uma categoria');
      return ProductCategory.create(input.category);
    },
    imageUrl: () => (input.imageUrl.trim() === '' ? null : ImageUrl.create(input.imageUrl)),
    preparationTime: () => PreparationTime.ofMinutes(parseMinutes(input.preparationTime)),
    isAvailable: () => input.isAvailable,
  });
}

/** Mensagens por campo para a validação em tempo real do formulário. */
export function productFormErrors(input: ProductFormInput): Partial<Record<ProductFormField, string>> {
  return collectFieldErrors(() => parseProductFormInput(input));
}

/** Preenche o formulário de edição a partir do produto (preço no formato brasileiro). */
export function productFormInputFrom(product: ProductDto): ProductFormInput {
  return {
    name: product.name,
    description: product.description,
    price: (product.priceCents / 100).toFixed(2).replace('.', ','),
    category: product.category,
    imageUrl: product.imageUrl ?? '',
    preparationTime: String(product.preparationTime),
    isAvailable: product.isAvailable,
  };
}

function parsePrice(raw: string): number {
  const value = raw.trim().replace(/^R\$\s*/, '');
  if (value === '') throw new InvalidProductPriceError('Informe o preço');
  if (!/^\d+([.,]\d+)?$/.test(value)) throw new InvalidProductPriceError('Informe um preço válido, como 32,90');
  return Number(value.replace(',', '.'));
}

function parseMinutes(raw: string): number {
  const value = raw.trim();
  if (value === '') throw new InvalidPreparationTimeError('Informe o tempo de preparo');
  return /^\d+$/.test(value) ? Number(value) : Number.NaN;
}
