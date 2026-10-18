import { useMutation } from '@tanstack/react-query';

import type { LoginInput, SessionDto } from '../../application';
import { useIdentityServices } from '../providers/identity-provider';

export function useLogin() {
  const { login } = useIdentityServices();
  return useMutation<SessionDto, Error, LoginInput>({
    mutationFn: (input) => login.execute(input),
  });
}
