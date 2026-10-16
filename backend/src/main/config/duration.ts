const UNIT_MS = { s: 1_000, m: 60_000, h: 3_600_000, d: 86_400_000 } as const;

/** Converte `30s`, `15m`, `12h`, `7d` (ou milissegundos puros) em milissegundos. */
export function parseDurationMs(raw: string): number | null {
  const match = /^(\d+)\s*(ms|s|m|h|d)?$/.exec(raw.trim());
  if (match === null) return null;
  const amount = Number(match[1]);
  const unit = match[2];
  if (unit === undefined || unit === 'ms') return amount;
  return amount * UNIT_MS[unit as keyof typeof UNIT_MS];
}
