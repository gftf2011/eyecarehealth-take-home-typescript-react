import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import { formatCents, useThemeColors } from '../../../../shared-kernel/presentation';
import type { TopProductsReport } from '../../../domain';

const MAX_LABEL = 22;

const shorten = (name: string): string => (name.length > MAX_LABEL ? `${name.slice(0, MAX_LABEL - 1)}…` : name);

/** Ranking dos mais vendidos por quantidade (barras horizontais) e a tabela equivalente. */
export function TopProductsChart({ report }: { readonly report: TopProductsReport }) {
  const colors = useThemeColors();
  const data = report.products.map((product) => ({ name: product.productName, quantity: product.totalQuantity }));
  const height = Math.max(160, data.length * 34);

  return (
    <>
      <div aria-hidden="true">
        <ResponsiveContainer width="100%" height={height}>
          <BarChart data={data} layout="vertical" margin={{ top: 0, right: 16, bottom: 0, left: 0 }}>
            <CartesianGrid stroke={colors.border} strokeDasharray="3 3" horizontal={false} />
            <XAxis type="number" allowDecimals={false} stroke={colors.textMuted} tick={{ fontSize: 12 }} />
            <YAxis
              type="category"
              dataKey="name"
              width={160}
              tickFormatter={shorten}
              stroke={colors.textMuted}
              tick={{ fontSize: 12 }}
            />
            <Tooltip
              formatter={(value) => [`${String(value)} un.`, 'Vendidos']}
              cursor={{ fill: colors.border, opacity: 0.4 }}
              contentStyle={{ background: colors.surface, borderColor: colors.border, color: colors.text }}
            />
            <Bar dataKey="quantity" fill={colors.brand} radius={[0, 6, 6, 0]} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <table className="visually-hidden">
        <caption>Produtos mais vendidos</caption>
        <thead>
          <tr>
            <th scope="col">Posição</th>
            <th scope="col">Produto</th>
            <th scope="col">Quantidade</th>
            <th scope="col">Receita</th>
          </tr>
        </thead>
        <tbody>
          {report.products.map((product, index) => (
            <tr key={product.productId}>
              <td>{index + 1}</td>
              <th scope="row">{product.productName}</th>
              <td>{product.totalQuantity}</td>
              <td>{formatCents(product.totalRevenueCents)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
