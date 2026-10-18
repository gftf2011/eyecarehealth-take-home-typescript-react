import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useRef, useState } from 'react';

import type { AssignmentPlan } from '../../domain';
import { useDeliveryServices } from '../providers/delivery-provider';

/**
 * Estado da sugestão na tela: pedir ao otimizador, aceitar (despacha na API),
 * rejeitar (só descarta) e aceitar todas em sequência. Cada aceite atualiza o
 * plano mais recente, então aceites em andamento não se sobrescrevem.
 */
export function useAssignmentPlan() {
  const { suggestAssignment, acceptAssignment } = useDeliveryServices();
  const queryClient = useQueryClient();
  const [plan, setPlanState] = useState<AssignmentPlan | null>(null);
  const [accepting, setAccepting] = useState<ReadonlySet<string>>(new Set());
  const [acceptError, setAcceptError] = useState<unknown>(null);
  const latest = useRef<AssignmentPlan | null>(null);

  const setPlan = useCallback((next: AssignmentPlan | null) => {
    latest.current = next;
    setPlanState(next);
  }, []);

  const suggest = useMutation({
    mutationFn: () => suggestAssignment.execute(),
    onMutate: () => {
      setAcceptError(null);
    },
    onSuccess: (suggested) => setPlan(suggested),
  });

  const accept = useCallback(
    async (orderId: string): Promise<void> => {
      const current = latest.current;
      if (current === null) return;
      setAccepting((ids) => new Set(ids).add(orderId));
      setAcceptError(null);
      try {
        const decided = await acceptAssignment.execute({ plan: current, orderId });
        const decision = decided.assignments.find((assignment) => assignment.orderId === orderId)?.decision;
        const base = latest.current ?? current;
        setPlan(decision?.status === 'failed' ? base.fail(orderId, decision.reason) : base.accept(orderId));
        // Pedidos e entregadores mudaram: telas de pedidos e o quadro recarregam.
        await queryClient.invalidateQueries();
      } catch (error) {
        setAcceptError(error);
      } finally {
        setAccepting((ids) => {
          const next = new Set(ids);
          next.delete(orderId);
          return next;
        });
      }
    },
    [acceptAssignment, queryClient, setPlan],
  );

  const acceptAll = useCallback(async (): Promise<void> => {
    for (const assignment of latest.current?.pending ?? []) {
      await accept(assignment.orderId);
    }
  }, [accept]);

  const reject = useCallback(
    (orderId: string) => {
      if (latest.current !== null) setPlan(latest.current.reject(orderId));
    },
    [setPlan],
  );

  return {
    plan,
    suggest: () => suggest.mutate(),
    suggesting: suggest.isPending,
    suggestError: suggest.error,
    accept,
    acceptAll,
    reject,
    accepting,
    acceptError,
    discard: () => setPlan(null),
  };
}
