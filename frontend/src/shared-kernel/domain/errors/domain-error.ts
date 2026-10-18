export type DomainErrorDetailValue = string | number | boolean | null;

export type DomainErrorDetail = Readonly<Record<string, DomainErrorDetailValue>>;

/**
 * Base de toda falha que a interface trata. As mesmas categorias da API: o
 * cliente HTTP traduz cada resposta de erro para a categoria do status, com o
 * `code` e a mensagem do servidor, e a apresentação decide o que mostrar sem
 * conhecer HTTP.
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

/** O recurso procurado não existe (ou não é visível). */
export abstract class NotFoundError extends DomainError {}

/** A operação conflita com o estado atual de outro recurso. */
export abstract class ConflictError extends DomainError {}

/** A operação viola uma regra de negócio (ex.: transição de status inválida). */
export abstract class BusinessRuleViolationError extends DomainError {}

/** Não foi possível comprovar a identidade de quem faz a requisição. */
export abstract class AuthenticationError extends DomainError {}

/** A identidade é conhecida, mas não tem permissão para a operação. */
export abstract class AuthorizationError extends DomainError {}

/** Limite de tentativas/requisições excedido; é preciso aguardar. */
export abstract class TooManyRequestsError extends DomainError {}

/** O servidor não respondeu, respondeu com falha interna ou num formato inesperado. */
export abstract class UnavailableError extends DomainError {}
