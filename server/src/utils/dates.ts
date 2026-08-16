import type { AnalyticsPeriod } from '../constants.js';

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
