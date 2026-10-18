import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';

import { useThemeColors } from '../../../../shared-kernel/presentation';
import type { OrdersByStatusReport } from '../../../domain';
import { STATUS_COLOR, STATUS_LABELS } from '../../labels/report-labels';
import styles from './orders-by-status-chart.module.css';

const percent = new Intl.NumberFormat('pt-BR', { style: 'percent', maximumFractionDigits: 0 });

/** Pedidos por status em rosca, com legenda que também é a versão acessível dos números. */
export function OrdersByStatusChart({ report }: { readonly report: OrdersByStatusReport }) {
  const colors = useThemeColors();
  const slices = report.data.filter((entry) => entry.count > 0);

  return (
    <div className={styles.layout}>
      <div className={styles.chart} aria-hidden="true">
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie
              data={slices.map((entry) => ({ name: STATUS_LABELS[entry.status], value: entry.count }))}
              dataKey="value"
              nameKey="name"
              innerRadius="58%"
              outerRadius="90%"
              paddingAngle={2}
              stroke={colors.surface}
              isAnimationActive={false}
            >
              {slices.map((entry) => (
                <Cell key={entry.status} fill={colors[STATUS_COLOR[entry.status]]} />
              ))}
            </Pie>
            <Tooltip contentStyle={{ background: colors.surface, borderColor: colors.border, color: colors.text }} />
          </PieChart>
        </ResponsiveContainer>
        <span className={styles.total}>
          <strong>{report.total}</strong>
          pedidos
        </span>
      </div>

      <ul className={styles.legend} aria-label="Pedidos por status">
        {report.data.map((entry) => (
          <li key={entry.status} className={styles.item}>
            <span className={styles.swatch} style={{ background: colors[STATUS_COLOR[entry.status]] }} aria-hidden="true" />
            <span className={styles.name}>{STATUS_LABELS[entry.status]}</span>
            <span className={styles.count}>{entry.count}</span>
            <span className={styles.share}>{report.total === 0 ? '—' : percent.format(entry.count / report.total)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
