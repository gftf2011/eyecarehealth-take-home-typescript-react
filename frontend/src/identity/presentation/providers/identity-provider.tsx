import { createContext, use, type ReactNode } from 'react';

import type { UseCase } from '../../../shared-kernel/application';
import type { LoginInput, SessionDto, SessionStore } from '../../application';

/** O que a interface do Identity usa: os casos de uso e a sessão observável. */
export type IdentityServices = {
  readonly login: UseCase<LoginInput, SessionDto>;
  readonly logout: UseCase<void, void>;
  readonly sessions: SessionStore;
};

const IdentityContext = createContext<IdentityServices | null>(null);

export function IdentityProvider({
  services,
  children,
}: {
  readonly services: IdentityServices;
  readonly children: ReactNode;
}) {
  return <IdentityContext value={services}>{children}</IdentityContext>;
}

export function useIdentityServices(): IdentityServices {
  const services = use(IdentityContext);
  if (services === null) {
    throw new Error('useIdentityServices precisa estar dentro de <IdentityProvider>');
  }
  return services;
}
