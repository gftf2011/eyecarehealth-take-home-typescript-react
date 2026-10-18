import type { ImageUrl } from './value-objects/image-url';
import type { PreparationTime } from './value-objects/preparation-time';
import type { ProductCategory } from './value-objects/product-category';
import type { ProductDescription } from './value-objects/product-description';
import type { ProductName } from './value-objects/product-name';
import type { ProductPrice } from './value-objects/product-price';

/** Dados editáveis de um produto, já validados pelos Value Objects. */
export type ProductDetails = {
  readonly name: ProductName;
  readonly description: ProductDescription;
  readonly price: ProductPrice;
  readonly category: ProductCategory;
  readonly imageUrl: ImageUrl | null;
  readonly preparationTime: PreparationTime;
  readonly isAvailable: boolean;
};

export type ProductProps = ProductDetails & {
  readonly id: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
};

/**
 * Produto do cardápio. Indisponível continua no painel (some só das
 * listagens públicas); removido some de tudo, mas pedidos antigos continuam
 * mostrando-o (soft delete na API).
 */
export class Product {
  private constructor(private readonly props: ProductProps) {}

  static restore(props: ProductProps): Product {
    return new Product(props);
  }

  get id(): string {
    return this.props.id;
  }

  get name(): ProductName {
    return this.props.name;
  }

  get description(): ProductDescription {
    return this.props.description;
  }

  get price(): ProductPrice {
    return this.props.price;
  }

  get category(): ProductCategory {
    return this.props.category;
  }

  get imageUrl(): ImageUrl | null {
    return this.props.imageUrl;
  }

  get preparationTime(): PreparationTime {
    return this.props.preparationTime;
  }

  get isAvailable(): boolean {
    return this.props.isAvailable;
  }

  get createdAt(): Date {
    return new Date(this.props.createdAt);
  }

  get updatedAt(): Date {
    return new Date(this.props.updatedAt);
  }
}
