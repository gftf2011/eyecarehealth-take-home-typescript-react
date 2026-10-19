import { z } from 'zod';

import { optionalIntegerQuery, uuid } from '../../../shared-kernel/presentation';
import { REPORTED_ORDER_STATUSES, REPORTED_VEHICLE_TYPES } from '../../domain';

const LOCAL_DATE = { format: 'date', examples: ['2026-10-17'] };

/**
 * Período dos relatórios em dias locais de São Paulo, as duas pontas
 * inclusivas. Sem datas, o período fica aberto (todo o histórico).
 */
export const periodQuerySchema = z.object({
  startDate: z.string().optional().meta({ ...LOCAL_DATE, description: 'Primeiro dia (`YYYY-MM-DD`, São Paulo), inclusive' }),
  endDate: z.string().optional().meta({ ...LOCAL_DATE, description: 'Último dia (`YYYY-MM-DD`, São Paulo), inclusive' }),
});

/**
 * Só documentação: a receita tem série diária, então as duas datas são
 * obrigatórias e o período tem até 366 dias. O controller lê a query com
 * `periodQuerySchema`, e o caso de uso recusa a data ausente com a mensagem
 * dele (`REQUIRED_FIELD`); a documentação mostra a regra como ela é.
 */
export const revenueQuerySchema = periodQuerySchema.extend({
  startDate: z.string().meta({ ...LOCAL_DATE, description: 'Primeiro dia (`YYYY-MM-DD`, São Paulo), inclusive. Obrigatório.' }),
  endDate: z.string().meta({ ...LOCAL_DATE, description: 'Último dia, inclusive. Obrigatório; no máximo 366 dias depois do início.' }),
});

export const topProductsQuerySchema = periodQuerySchema.extend({
  limit: optionalIntegerQuery.meta({ description: 'Quantos produtos (1 a 100, padrão 10)', minimum: 1, maximum: 100 }),
});

export const revenueReportSchema = z.strictObject({
  startDate: z.string().meta({ format: 'date' }),
  endDate: z.string().meta({ format: 'date' }),
  totalRevenue: z.number().meta({ description: 'Soma dos pedidos entregues no período (pela data da entrega), em reais' }),
  totalOrders: z.number().int(),
  averageOrderValue: z.number(),
  dailyRevenue: z.array(
    z.strictObject({ date: z.string().meta({ format: 'date' }), revenue: z.number(), orders: z.number().int() }),
  ),
});

export const ordersByStatusReportSchema = z.strictObject({
  data: z.array(z.strictObject({ status: z.enum(REPORTED_ORDER_STATUSES), count: z.number().int() })),
  total: z.number().int(),
});

export const topProductsReportSchema = z.strictObject({
  data: z.array(
    z.strictObject({
      productId: uuid,
      productName: z.string().meta({ description: 'Nome atual do produto' }),
      totalQuantity: z.number().int(),
      totalRevenue: z.number(),
    }),
  ),
});

export const deliveryTimeReportSchema = z.strictObject({
  averageMinutes: z.number().nullable().meta({ description: 'Da criação à entrega; `null` sem entregas no período' }),
  fastestMinutes: z.number().nullable(),
  slowestMinutes: z.number().nullable(),
  totalDelivered: z.number().int(),
  byVehicleType: z.array(
    z.strictObject({
      vehicleType: z.enum(REPORTED_VEHICLE_TYPES),
      averageMinutes: z.number(),
      fastestMinutes: z.number(),
      slowestMinutes: z.number(),
      count: z.number().int(),
    }),
  ),
});
