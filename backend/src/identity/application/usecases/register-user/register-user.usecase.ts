import { validateInput, type Clock, type UseCase } from '../../../../shared-kernel/application';
import { Email, EmailAlreadyInUseError, Role, User, UserId } from '../../../domain';
import { toAuthenticatedUserDto, type AuthenticatedUserDto } from '../../dtos/auth-tokens.dto';
import { InvalidPasswordError } from '../../errors/invalid-password.error';
import type { IdentityUnitOfWork } from '../../ports/identity-unit-of-work';
import type { PasswordHasher } from '../../ports/password-hasher';

const MIN_PASSWORD_LENGTH = 8;
/** Limite do bcrypt: bytes além de 72 são ignorados no hash. */
const MAX_PASSWORD_BYTES = 72;

export type RegisterUserInput = {
  readonly email: string;
  readonly password: string;
  /** `admin` ou `viewer`. */
  readonly role: string;
};

/**
 * Cadastra um usuário do painel com a senha em bcrypt. Usado pelo seed; não
 * há rota pública de cadastro (os acessos são criados pela operação).
 */
export class RegisterUserUseCase implements UseCase<RegisterUserInput, AuthenticatedUserDto> {
  constructor(
    private readonly unitOfWork: IdentityUnitOfWork,
    private readonly passwordHasher: PasswordHasher,
    private readonly clock: Clock,
  ) {}

  async execute(input: RegisterUserInput): Promise<AuthenticatedUserDto> {
    const { email, role } = validateInput({
      email: () => Email.create(input.email),
      password: () => ensurePasswordPolicy(input.password),
      role: () => Role.create(input.role),
    });

    // O bcrypt (~50ms) roda fora da transação para não prender conexão.
    const passwordHash = await this.passwordHasher.hash(input.password);

    return this.unitOfWork.transaction(async ({ users }) => {
      // Checagem amigável; a constraint UNIQUE do banco garante sob concorrência.
      if ((await users.findByEmail(email)) !== null) throw new EmailAlreadyInUseError(email);

      const user = User.register({ id: UserId.generate(), email, passwordHash, role, now: this.clock.now() });
      await users.save(user);
      return toAuthenticatedUserDto(user);
    });
  }
}

function ensurePasswordPolicy(password: string): string {
  if (password.length < MIN_PASSWORD_LENGTH || Buffer.byteLength(password, 'utf8') > MAX_PASSWORD_BYTES) {
    throw new InvalidPasswordError(MIN_PASSWORD_LENGTH, MAX_PASSWORD_BYTES);
  }
  return password;
}
