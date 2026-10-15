import { ValueObject } from '../../../../shared-kernel/domain/index.js';
import { InvalidLocalDateError } from '../errors/index.js';
import { startOfDayInstant } from '../time-zone.js';

const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const MIN_YEAR = 1900;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Data de calendário sem hora nem fuso (`YYYY-MM-DD`). */
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

  toJSON(): string {
    return this.toString();
  }

  addDays(days: number): LocalDate {
    const date = new Date(this.epochMs + days * MS_PER_DAY);
    return new LocalDate(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
  }

  compareTo(other: LocalDate): number {
    return Math.sign(this.epochMs - other.epochMs);
  }

  isAfter(other: LocalDate): boolean {
    return this.compareTo(other) > 0;
  }

  /** Instante UTC em que este dia começa no fuso informado. */
  startOfDayIn(timeZone: string): Date {
    return startOfDayInstant(this.props.year, this.props.month, this.props.day, timeZone);
  }

  private get epochMs(): number {
    return Date.UTC(this.props.year, this.props.month - 1, this.props.day);
  }
}
