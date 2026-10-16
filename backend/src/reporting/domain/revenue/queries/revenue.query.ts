import type { InstantRange } from '../../../../shared-kernel/domain';

/** Receita de um dia local, já agregada pelo banco. */
export type DailyRevenueRow = {
  /** Dia local (fuso do negócio) da entrega, `YYYY-MM-DD`. */
  readonly date: string;
  readonly revenueCents: number;
  readonly orders: number;
};

/**
 * Port de leitura: soma `total_amount` dos pedidos `delivered` cuja entrega
 * (transição para `delivered`) ocorreu em `range`, agrupando pelo dia local
 * no fuso informado. Dias sem venda podem ser omitidos.
 */
export interface RevenueQuery {
  dailyRevenue(range: InstantRange, timeZone: string): Promise<readonly DailyRevenueRow[]>;
}
