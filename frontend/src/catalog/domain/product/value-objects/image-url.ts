import { ValueObject } from '../../../../shared-kernel/domain';
import { InvalidImageUrlError } from '../errors';

const MAX_LENGTH = 500;
const ALLOWED_PROTOCOLS = new Set(['http:', 'https:']);

export class ImageUrl extends ValueObject<{ value: string }> {
  private constructor(value: string) {
    super({ value });
  }

  static create(raw: string): ImageUrl {
    const value = raw.trim();
    if (value.length > MAX_LENGTH) {
      throw new InvalidImageUrlError(`A URL da imagem deve ter no máximo ${MAX_LENGTH} caracteres`);
    }
    if (!ImageUrl.isHttpUrl(value)) {
      throw new InvalidImageUrlError('A URL da imagem deve ser uma URL http(s) válida');
    }
    return new ImageUrl(value);
  }

  private static isHttpUrl(value: string): boolean {
    if (!URL.canParse(value)) return false;
    return ALLOWED_PROTOCOLS.has(new URL(value).protocol);
  }

  get value(): string {
    return this.props.value;
  }
}
