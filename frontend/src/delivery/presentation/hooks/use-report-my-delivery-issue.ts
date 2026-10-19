import { useMutation, useQueryClient } from '@tanstack/react-query';

import type { ReportMyDeliveryIssueInput } from '../../application';
import { useDeliveryServices } from '../providers/delivery-provider';
import { MY_DELIVERIES_QUERY_KEY } from './use-my-deliveries';

/** Relata o problema e recarrega a tela (a entrega passa a mostrar "aguardando o gestor"). */
export function useReportMyDeliveryIssue() {
  const { reportMyDeliveryIssue } = useDeliveryServices();
  const queryClient = useQueryClient();
  return useMutation<void, Error, ReportMyDeliveryIssueInput>({
    mutationFn: (input) => reportMyDeliveryIssue.execute(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: MY_DELIVERIES_QUERY_KEY }),
  });
}
