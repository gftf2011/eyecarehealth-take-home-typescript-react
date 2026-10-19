import type { UnassignedReason, VehicleTypeValue } from '../../domain';

export const VEHICLE_LABELS: Readonly<Record<VehicleTypeValue, string>> = {
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

/** Coordenada em graus decimais no formato brasileiro (`-23,5489`). */
export function formatCoordinate(value: number): string {
  return value.toLocaleString('pt-BR', { maximumFractionDigits: 6 });
}
