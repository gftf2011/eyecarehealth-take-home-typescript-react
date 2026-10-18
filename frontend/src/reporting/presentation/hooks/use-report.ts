import { keepPreviousData, useQuery } from '@tanstack/react-query';

import type { ReportPeriodInput } from '../../application';
import { useReportingServices, type ReportingServices } from '../providers/reporting-provider';

export type ReportKind = keyof ReportingServices;

type ReportOf<TKind extends ReportKind> = Awaited<ReturnType<ReportingServices[TKind]['execute']>>;

/**
 * Um relatório para o período. Cada relatório tem a própria consulta: um que
 * falha não derruba os outros, e trocar o período mantém os números antigos
 * na tela até os novos chegarem. Período inválido não consulta a API.
 */
export function useReport<TKind extends ReportKind>(kind: TKind, period: ReportPeriodInput, enabled: boolean) {
  const services = useReportingServices();
  return useQuery<ReportOf<TKind>>({
    queryKey: ['reports', kind, period.startDate, period.endDate],
    queryFn: ({ signal }) => services[kind].execute({ ...period, signal }) as Promise<ReportOf<TKind>>,
    enabled,
    placeholderData: keepPreviousData,
  });
}
