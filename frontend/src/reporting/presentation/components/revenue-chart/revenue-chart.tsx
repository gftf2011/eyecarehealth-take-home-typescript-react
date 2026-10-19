import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import { formatCents, useThemeColors } from '../../../../shared-kernel/presentation';
import type { RevenueReport } from '../../../domain';
import { formatShortDay } from '../../labels/report-labels';

const compactCurrency = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  notation: 'compact',
  maximumFractionDigits: 1,
});

/** Receita por dia do período (gráfico de área) com a tabela equivalente para leitores de tela. */
export function RevenueChart({ report }: { readonly report: RevenueReport }) {
  const colors = useThemeColors();
  const data = report.daily.map((day) => ({
    day: day.date.toString(),
    revenue: day.revenueCents / 100,
    orders: day.orders,
  }));

  return (
    <>
      <div aria-hidden="true">
        <ResponsiveContainer width="100%" height={260}>
          <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="revenue-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={colors.brand} stopOpacity={0.35} />
                <stop offset="100%" stopColor={colors.brand} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke={colors.border} strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="day"
              tickFormatter={formatShortDay}
              stroke={colors.textMuted}
              tick={{ fontSize: 12 }}
              minTickGap={24}
            />
            <YAxis
              tickFormatter={(value: number) => compactCurrency.format(value)}
              stroke={colors.textMuted}
              tick={{ fontSize: 12 }}
              width={64}
            />
            <Tooltip
              formatter={(value) => [formatCents(Math.round(Number(value) * 100)), 'Receita']}
              labelFormatter={(label) => (typeof label === 'string' ? formatShortDay(label) : '')}
              contentStyle={{ background: colors.surface, borderColor: colors.border, color: colors.text }}
            />
            <Area
              type="monotone"
              dataKey="revenue"
              stroke={colors.brand}
              strokeWidth={2}
              fill="url(#revenue-fill)"
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <table className="visually-hidden">
        <caption>Receita por dia</caption>
        <thead>
          <tr>
            <th scope="col">Dia</th>
            <th scope="col">Receita</th>
            <th scope="col">Pedidos entregues</th>
          </tr>
        </thead>
        <tbody>
          {report.daily.map((day) => (
            <tr key={day.date.toString()}>
              <th scope="row">{formatShortDay(day.date.toString())}</th>
              <td>{formatCents(day.revenueCents)}</td>
              <td>{day.orders}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
