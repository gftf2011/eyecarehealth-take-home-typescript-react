import type { CourierDeliveryStatus, CourierIssueReason, UnassignedReason, VehicleTypeValue } from '../../domain';

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

/** Como o entregador vê o status dos pedidos dele. */
export const COURIER_STATUS_LABELS: Readonly<Record<CourierDeliveryStatus, string>> = {
  pending: 'Aguardando preparo',
  preparing: 'Em preparo',
  ready: 'Pronto para retirar',
  delivering: 'Em entrega',
};

/** Link para abrir o destino no aplicativo de mapas do celular. */
export function mapsUrl(latitude: number, longitude: number): string {
  return `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
}

/** Motivos que o entregador escolhe quando não consegue entregar. */
export const COURIER_ISSUE_REASON_LABELS: Readonly<Record<CourierIssueReason, string>> = {
  customer_absent: 'Cliente ausente',
  address_not_found: 'Endereço não encontrado',
  refused: 'Cliente recusou',
  other: 'Outro motivo',
};
