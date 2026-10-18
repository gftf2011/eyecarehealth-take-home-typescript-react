import { useMutation, useQueryClient } from '@tanstack/react-query';

import { useIdentityServices } from '../providers/identity-provider';

/** Sai do painel e descarta o cache de consultas (os dados eram do usuário que saiu). */
export function useLogout() {
  const { logout } = useIdentityServices();
  const queryClient = useQueryClient();
  return useMutation<void, Error, void>({
    mutationFn: () => logout.execute(),
    onSettled: () => {
      queryClient.clear();
    },
  });
}
