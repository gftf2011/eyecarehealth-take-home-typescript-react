import { beforeEach, describe, expect, it } from 'vitest';

import { InputValidationError } from '../../../../shared-kernel/application';
import { FixedClock } from '../../../../shared-kernel/application/testing/fixed-clock';
import { Email, EmailAlreadyInUseError, UserRegistered } from '../../../domain';
import { FakePasswordHasher } from '../../testing/fake-security';
import { InMemoryIdentityUnitOfWork } from '../../testing/in-memory-identity-unit-of-work';
import { RegisterUserUseCase } from './register-user.usecase';

const NOW = new Date('2025-03-01T10:00:00Z');

describe('RegisterUserUseCase', () => {
  let unitOfWork: InMemoryIdentityUnitOfWork;
  let hasher: FakePasswordHasher;
  let register: RegisterUserUseCase;

  beforeEach(() => {
    unitOfWork = new InMemoryIdentityUnitOfWork();
    hasher = new FakePasswordHasher();
    register = new RegisterUserUseCase(unitOfWork, hasher, new FixedClock(NOW));
  });

  async function storedUser(email: string) {
    return unitOfWork.transaction(({ users }) => users.findByEmail(Email.create(email)));
  }

  it('cadastra o usuário com email normalizado e a senha só como hash', async () => {
    const user = await register.execute({ email: ' Admin@FastMeals.com ', password: 'Admin@123', role: 'admin' });

    expect(user).toEqual({ id: expect.stringMatching(/^[0-9a-f-]{36}$/), email: 'admin@fastmeals.com', role: 'admin' });
    const stored = await storedUser('admin@fastmeals.com');
    if (stored === null) throw new Error('usuário não gravado');
    expect(stored.passwordHash.value).toMatch(/^\$2b\$10\$/);
    expect(stored.passwordHash.value).not.toContain('Admin@123');
    expect(await hasher.verify('Admin@123', stored.passwordHash)).toBe(true);
  });

  it('publica UserRegistered ao confirmar a transação', async () => {
    await register.execute({ email: 'viewer@fastmeals.com', password: 'Viewer@123', role: 'viewer' });

    expect(unitOfWork.publishedEvents.map((event) => event.constructor)).toEqual([UserRegistered]);
  });

  it('409 EMAIL_ALREADY_IN_USE para email já cadastrado (sem diferenciar maiúsculas)', async () => {
    await register.execute({ email: 'admin@fastmeals.com', password: 'Admin@123', role: 'admin' });

    const attempt = register.execute({ email: 'ADMIN@fastmeals.com', password: 'Outra@123', role: 'viewer' });

    await expect(attempt).rejects.toBeInstanceOf(EmailAlreadyInUseError);
    expect(unitOfWork.users.size).toBe(1);
  });

  it('rejeita email, senha e perfil inválidos de uma vez, sem gerar hash', async () => {
    const attempt = register.execute({ email: 'admin', password: 'curta', role: 'root' });

    await expect(attempt).rejects.toBeInstanceOf(InputValidationError);
    await expect(attempt).rejects.toMatchObject({
      details: [
        { field: 'email' },
        { field: 'password', message: 'A senha deve ter pelo menos 8 caracteres e no máximo 72 bytes' },
        { field: 'role', message: 'O perfil deve ser um de: admin, viewer' },
      ],
    });
    expect(unitOfWork.commits + unitOfWork.rollbacks).toBe(0);
  });

  it('rejeita senha acima de 72 bytes (o bcrypt ignoraria o excesso)', async () => {
    await expect(
      register.execute({ email: 'admin@fastmeals.com', password: 'é'.repeat(37), role: 'admin' }),
    ).rejects.toMatchObject({ details: [{ field: 'password' }] });
  });
});
