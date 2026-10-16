/**
 * Fuso do negócio: filtros e agrupamentos por dia usam dias locais de São
 * Paulo. Um pedido entregue às 22h de 31/12 (local) conta em 31/12, não em
 * 01/01 (UTC).
 */
export const BUSINESS_TIME_ZONE = 'America/Sao_Paulo';

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timeZone: string): Intl.DateTimeFormat {
  let formatter = formatters.get(timeZone);
  if (formatter === undefined) {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    formatters.set(timeZone, formatter);
  }
  return formatter;
}

/** Diferença (ms) entre o relógio local do fuso e o UTC naquele instante. */
function offsetAt(instantMs: number, timeZone: string): number {
  const parts = formatterFor(timeZone).formatToParts(new Date(instantMs));
  const part = (type: Intl.DateTimeFormatPartTypes): number =>
    Number(parts.find((candidate) => candidate.type === type)?.value);

  const wallClockAsUtc = Date.UTC(
    part('year'),
    part('month') - 1,
    part('day'),
    part('hour'),
    part('minute'),
    part('second'),
  );
  return wallClockAsUtc - (instantMs - (instantMs % 1000));
}

/**
 * Converte um horário de parede (ano, mês, dia, 00:00) no fuso informado para
 * o instante UTC correspondente, respeitando horário de verão histórico.
 * Usa `Intl` (nativo do runtime), sem bibliotecas de data.
 */
export function startOfDayInstant(
  year: number,
  month: number,
  day: number,
  timeZone: string,
): Date {
  const wallClockAsUtc = Date.UTC(year, month - 1, day);
  const firstGuess = wallClockAsUtc - offsetAt(wallClockAsUtc, timeZone);
  // Segunda passada corrige casos em que o offset muda entre o palpite e o alvo.
  return new Date(wallClockAsUtc - offsetAt(firstGuess, timeZone));
}
