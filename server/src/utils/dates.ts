import type { AnalyticsPeriod } from '../constants.js';
import { AppError } from '../errors/app-error.js';

const DAY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export function parseDay(value: string): Date {
  const match = DAY_PATTERN.exec(value);

  if (!match) {
    throw new AppError(400, 'Дата: ГГГГ-ММ-ДД');
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);

  if (
    date.getFullYear() !== year
    || date.getMonth() !== month - 1
    || date.getDate() !== day
  ) {
    throw new AppError(400, 'Некорректная дата');
  }

  return date;
}

export function queryDateRange(
  fromValue: unknown,
  toValue: unknown,
): { from: Date; to: Date } | null {
  const fromRaw = typeof fromValue === 'string' ? fromValue : '';
  const toRaw = typeof toValue === 'string' ? toValue : '';

  if (!fromRaw && !toRaw) {
    return null;
  }

  if (!fromRaw || !toRaw) {
    throw new AppError(400, 'Нужны обе даты from и to');
  }

  const from = startOfDay(parseDay(fromRaw));
  const to = parseDay(toRaw);
  to.setHours(23, 59, 59, 999);

  if (from.getTime() > to.getTime()) {
    throw new AppError(400, 'Дата начала позже даты конца');
  }

  return { from, to };
}

export function periodRange(period: AnalyticsPeriod, now = new Date()): {
  from: Date;
  to: Date;
} {
  const to = new Date(now);
  const from = new Date(now);

  if (period === '7d') {
    from.setDate(from.getDate() - 6);
  } else if (period === '30d') {
    from.setDate(from.getDate() - 29);
  } else if (period === 'quarter') {
    from.setMonth(from.getMonth() - 3);
  } else if (period === 'year') {
    from.setFullYear(from.getFullYear() - 1);
  } else if (period === '3y') {
    from.setFullYear(from.getFullYear() - 3);
  } else if (period === '5y') {
    from.setFullYear(from.getFullYear() - 5);
  }

  from.setHours(0, 0, 0, 0);
  to.setHours(23, 59, 59, 999);

  return { from, to };
}

export function startOfDay(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

export function addDays(date: Date, days: number): Date {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

export function weekStart(date: Date): Date {
  const copy = startOfDay(date);
  const weekday = copy.getDay();
  const offset = weekday === 0 ? 6 : weekday - 1;
  copy.setDate(copy.getDate() - offset);
  return copy;
}
