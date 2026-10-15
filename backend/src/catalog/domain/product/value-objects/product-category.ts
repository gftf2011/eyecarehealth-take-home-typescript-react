import { ValueObject } from '../../../../shared-kernel/domain';
import { InvalidProductCategoryError } from '../errors';

export const PRODUCT_CATEGORIES = ['meal', 'drink', 'dessert', 'side'] as const;

export type ProductCategoryValue = (typeof PRODUCT_CATEGORIES)[number];

export class ProductCategory extends ValueObject<{ value: ProductCategoryValue }> {
  private constructor(value: ProductCategoryValue) {
    super({ value });
  }

  static create(raw: string): ProductCategory {
    if (!ProductCategory.isValid(raw)) {
      throw new InvalidProductCategoryError(
        `A categoria deve ser uma de: ${PRODUCT_CATEGORIES.join(', ')}`,
      );
    }
    return new ProductCategory(raw);
  }

  static isValid(raw: string): raw is ProductCategoryValue {
    return (PRODUCT_CATEGORIES as readonly string[]).includes(raw);
  }

  get value(): ProductCategoryValue {
    return this.props.value;
  }
}
