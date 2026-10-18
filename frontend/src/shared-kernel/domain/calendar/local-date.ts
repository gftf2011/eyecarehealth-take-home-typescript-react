import { InvalidLocalDateError } from '../errors/invalid-local-date.error';
import { ValueObject } from '../value-object';

const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const MIN_YEAR = 1900;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Data de calendário sem hora nem fuso (`YYYY-MM-DD`), com as mesmas regras
 * da API. Os filtros por período usam dias locais do negócio (São Paulo).
 */
export class LocalDate extends ValueObject<{ year: number; month: number; day: number }> {
  private constructor(year: number, month: number, day: number) {
    super({ year, month, day });
  }

  static parse(raw: string, field = 'date'): LocalDate {
    const match = ISO_DATE_PATTERN.exec(raw);
    if (match === null) throw new InvalidLocalDateError(field, raw);

    const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
    const probe = new Date(Date.UTC(year, month - 1, day));
    const isRealDate =
      year >= MIN_YEAR &&
      probe.getUTCFullYear() === year &&
      probe.getUTCMonth() === month - 1 &&
      probe.getUTCDate() === day;
    if (!isRealDate) throw new InvalidLocalDateError(field, raw);

    return new LocalDate(year, month, day);
  }

  /** Dia de `instant` no fuso informado (ex.: "hoje" em São Paulo). */
  static of(instant: Date, timeZone: string): LocalDate {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(instant);
    return LocalDate.parse(parts);
  }

  get year(): number {
    return this.props.year;
  }

  get month(): number {
    return this.props.month;
  }

  get day(): number {
    return this.props.day;
  }

  override toString(): string {
    const pad = (value: number): string => value.toString().padStart(2, '0');
    return `${this.props.year}-${pad(this.props.month)}-${pad(this.props.day)}`;
  }

  addDays(days: number): LocalDate {
    const date = new Date(this.epochMs + days * MS_PER_DAY);
    return new LocalDate(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
  }

  isAfter(other: LocalDate): boolean {
    return this.epochMs > other.epochMs;
  }

  private get epochMs(): number {
    return Date.UTC(this.props.year, this.props.month - 1, this.props.day);
  }
}
