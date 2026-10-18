import type { UnassignedReason, VehicleType } from '../../domain';

export const VEHICLE_LABELS: Readonly<Record<VehicleType, string>> = {
  bicycle: 'Bicicleta',
  motorcycle: 'Moto',
  car: 'Carro',
};

export const UNASSIGNED_REASON_LABELS: Readonly<Record<UnassignedReason, string>> = {
  NO_AVAILABLE_DELIVERY_PERSON: 'Sem entregador disponível',
  UNKNOWN: 'Não foi possível sugerir um entregador',
};

export function formatKm(km: number): string {
  return `${km.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} km`;
}
