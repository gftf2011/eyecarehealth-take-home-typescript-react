import type { ThemeColors } from '../../../shared-kernel/presentation';
import type { ReportedOrderStatus, ReportedVehicleType } from '../../domain';

export const STATUS_LABELS: Readonly<Record<ReportedOrderStatus, string>> = {
  pending: 'Pendente',
  preparing: 'Em preparo',
  ready: 'Pronto',
  delivering: 'Em entrega',
  delivered: 'Entregue',
  cancelled: 'Cancelado',
};

/** As mesmas cores de status do painel de pedidos. */
export const STATUS_COLOR: Readonly<Record<ReportedOrderStatus, keyof ThemeColors>> = {
  pending: 'textMuted',
  preparing: 'warning',
  ready: 'brand',
  delivering: 'info',
  delivered: 'success',
  cancelled: 'danger',
};

export const VEHICLE_LABELS: Readonly<Record<ReportedVehicleType, string>> = {
  bicycle: 'Bicicleta',
  motorcycle: 'Moto',
  car: 'Carro',
};

/** `95.5` → `1 h 36 min`; `42` → `42 min`. */
export function formatMinutes(minutes: number): string {
  const rounded = Math.round(minutes);
  if (rounded < 60) return `${rounded} min`;
  const hours = Math.floor(rounded / 60);
  const rest = rounded % 60;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}

/** `2026-10-07` → `07/10`. */
export function formatShortDay(isoDay: string): string {
  const [, month, day] = isoDay.split('-');
  return `${day}/${month}`;
}
