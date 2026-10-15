export type DomainErrorDetailValue = string | number | boolean | null;

export type DomainErrorDetail = Readonly<Record<string, DomainErrorDetailValue>>;

/**
 * Base de toda falha de negócio. O domínio nunca fala HTTP: a borda decide o
 * status a partir da categoria (subclasses abaixo) e expõe `code` e `details`.
 */
export abstract class DomainError extends Error {
  abstract readonly code: string;
  readonly details: readonly DomainErrorDetail[];

  protected constructor(message: string, details: readonly DomainErrorDetail[] = []) {
    super(message);
    this.name = new.target.name;
    this.details = details;
  }
}

/** Um valor não satisfaz a invariante de um Value Object. */
export abstract class InvalidValueError extends DomainError {
  readonly field: string;

  protected constructor(field: string, message: string) {
    super(message, [{ field, message }]);
    this.field = field;
  }
}

/** O recurso procurado não existe (ou não é visível) no contexto. */
export abstract class NotFoundError extends DomainError {}

/** A operação conflita com o estado atual de outro recurso. */
export abstract class ConflictError extends DomainError {}

/** A operação viola uma regra de negócio do agregado (ex.: transição inválida). */
export abstract class BusinessRuleViolationError extends DomainError {}

/** Não foi possível comprovar a identidade de quem faz a requisição. */
export abstract class AuthenticationError extends DomainError {}

/** A identidade é conhecida, mas não tem permissão para a operação. */
export abstract class AuthorizationError extends DomainError {}
