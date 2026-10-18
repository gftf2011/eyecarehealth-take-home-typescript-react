import { useState } from 'react';

import { Button, TextField } from '../../../../shared-kernel/presentation';
import { reportPeriodErrors, type ReportPeriodInput } from '../../../application';
import { ReportPeriod } from '../../../domain';
import { todayInBusinessTimeZone } from '../../hooks/use-report-period';
import styles from './report-period-filter.module.css';

const PRESETS = [
  { label: 'Últimos 7 dias', period: () => ReportPeriod.lastDays(7, todayInBusinessTimeZone()) },
  { label: 'Últimos 30 dias', period: () => ReportPeriod.lastDays(30, todayInBusinessTimeZone()) },
  { label: 'Este mês', period: () => ReportPeriod.monthToDate(todayInBusinessTimeZone()) },
] as const;

const same = (a: ReportPeriodInput, b: ReportPeriodInput): boolean =>
  a.startDate === b.startDate && a.endDate === b.endDate;

/**
 * Período dos relatórios com atalhos. Datas válidas são aplicadas na hora;
 * inválidas (fim antes do início, mais de 366 dias) mostram o erro e não
 * consultam a API.
 */
export function ReportPeriodFilter({
  value,
  onApply,
}: {
  readonly value: ReportPeriodInput;
  readonly onApply: (period: ReportPeriodInput) => void;
}) {
  const [draft, setDraft] = useState(value);
  const [synced, setSynced] = useState(value);
  if (!same(synced, value)) {
    setSynced(value);
    setDraft(value);
  }
  const errors = reportPeriodErrors(draft);

  const change = (next: ReportPeriodInput): void => {
    setDraft(next);
    if (Object.keys(reportPeriodErrors(next)).length === 0) onApply(next);
  };

  return (
    <form className={styles.filter} aria-label="Período dos relatórios" onSubmit={(event) => event.preventDefault()}>
      <TextField
        label="De"
        type="date"
        value={draft.startDate ?? ''}
        onChange={(event) => change({ ...draft, startDate: event.target.value })}
        error={errors.startDate}
      />
      <TextField
        label="Até"
        type="date"
        value={draft.endDate ?? ''}
        min={draft.startDate}
        onChange={(event) => change({ ...draft, endDate: event.target.value })}
        error={errors.endDate}
      />
      <div className={styles.presets} role="group" aria-label="Atalhos de período">
        {PRESETS.map((preset) => {
          const period = preset.period();
          const input = { startDate: period.start.toString(), endDate: period.end.toString() };
          return (
            <Button
              key={preset.label}
              size="sm"
              variant={same(input, value) ? 'primary' : 'secondary'}
              aria-pressed={same(input, value)}
              onClick={() => change(input)}
            >
              {preset.label}
            </Button>
          );
        })}
      </div>
    </form>
  );
}
