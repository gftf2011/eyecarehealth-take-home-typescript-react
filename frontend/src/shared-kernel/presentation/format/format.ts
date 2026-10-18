import { BUSINESS_TIME_ZONE } from '../../domain';

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

const dateTime = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'short',
  timeStyle: 'short',
  timeZone: BUSINESS_TIME_ZONE,
});

const date = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeZone: BUSINESS_TIME_ZONE });

/** `6580` → `R$ 65,80`. Valores trafegam em centavos inteiros até aqui. */
export function formatCents(cents: number): string {
  return currency.format(cents / 100);
}

/** Data e hora no fuso do negócio (os filtros por dia também usam São Paulo). */
export function formatDateTime(value: Date): string {
  return dateTime.format(value);
}

export function formatDate(value: Date): string {
  return date.format(value);
}
