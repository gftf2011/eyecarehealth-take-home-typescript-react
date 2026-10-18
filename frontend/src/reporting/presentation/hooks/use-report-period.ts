import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router';

import { BUSINESS_TIME_ZONE, LocalDate } from '../../../shared-kernel/domain';
import { reportPeriodErrors, type ReportPeriodInput } from '../../application';
import { ReportPeriod } from '../../domain';

const DEFAULT_DAYS = 30;

/** Hoje no fuso do negócio (os relatórios contam dias de São Paulo). */
export function todayInBusinessTimeZone(): LocalDate {
  return LocalDate.of(new Date(), BUSINESS_TIME_ZONE);
}

/** Período na URL (`startDate`/`endDate`); sem nada, os últimos 30 dias. */
export function useReportPeriod() {
  const [params, setParams] = useSearchParams();

  const fallback = useMemo(() => ReportPeriod.lastDays(DEFAULT_DAYS, todayInBusinessTimeZone()), []);
  const period: ReportPeriodInput = {
    startDate: params.get('startDate') ?? fallback.start.toString(),
    endDate: params.get('endDate') ?? fallback.end.toString(),
  };
  const valid = Object.keys(reportPeriodErrors(period)).length === 0;

  const applyPeriod = useCallback(
    (next: ReportPeriodInput) =>
      setParams((current) => {
        const updated = new URLSearchParams(current);
        updated.set('startDate', next.startDate ?? '');
        updated.set('endDate', next.endDate ?? '');
        return updated;
      }),
    [setParams],
  );

  return { period, valid, applyPeriod };
}
