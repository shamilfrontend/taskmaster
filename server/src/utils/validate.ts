import mongoose from 'mongoose';
import { AppError } from '../errors/app-error.js';
import {
  ANALYTICS_PERIODS,
  BOARD_BACKGROUNDS,
  INVITE_ROLES,
  LABEL_COLORS,
  TEAM_ROLES,
  type AnalyticsPeriod,
  type BoardBackground,
  type InviteRole,
  type LabelColor,
  type TeamRole,
} from '../constants.js';

export function asObjectId(value: string, field = 'id'): mongoose.Types.ObjectId {
  if (!mongoose.Types.ObjectId.isValid(value)) {
    throw new AppError(400, `Некорректный ${field}`);
  }

  return new mongoose.Types.ObjectId(value);
}

export function readString(body: unknown, field: string): string {
  if (typeof body !== 'object' || body === null) {
    throw new AppError(400, 'Некорректное тело запроса');
  }

  const value = (body as Record<string, unknown>)[field];

  if (typeof value !== 'string') {
    throw new AppError(400, `Поле ${field} обязательно`);
  }

  const trimmed = value.trim();

  if (!trimmed) {
    throw new AppError(400, `Поле ${field} обязательно`);
  }

  return trimmed;
}

export function readOptionalString(
  body: unknown,
  field: string,
): string | undefined {
  if (typeof body !== 'object' || body === null) {
    throw new AppError(400, 'Некорректное тело запроса');
  }

  const value = (body as Record<string, unknown>)[field];

  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  if (typeof value !== 'string') {
    throw new AppError(400, `Поле ${field} должно быть строкой`);
  }

  const trimmed = value.trim();
  return trimmed || undefined;
}

export function readNumber(body: unknown, field: string): number {
  if (typeof body !== 'object' || body === null) {
    throw new AppError(400, 'Некорректное тело запроса');
  }

  const value = (body as Record<string, unknown>)[field];
  const num = typeof value === 'number' ? value : Number(value);

  if (!Number.isFinite(num)) {
    throw new AppError(400, `Поле ${field} должно быть числом`);
  }

  return num;
}

function isHalfStep(value: number): boolean {
  return Math.abs(value * 2 - Math.round(value * 2)) < 1e-9;
}

export function readHours(body: unknown, field: string): number {
  const value = readNumber(body, field);

  if (value < 0.5 || value > 24 || !isHalfStep(value)) {
    throw new AppError(400, `${field}: 0.5–24, шаг 0.5`);
  }

  return value;
}

export function readEstimate(body: unknown, field: string): number {
  const value = readNumber(body, field);

  if (value < 0 || value > 1000 || !isHalfStep(value)) {
    throw new AppError(400, `${field}: 0–1000, шаг 0.5`);
  }

  return value;
}

export function readTeamRole(body: unknown, field: string): TeamRole {
  const value = readString(body, field);

  if (!TEAM_ROLES.includes(value as TeamRole)) {
    throw new AppError(400, 'Некорректная роль');
  }

  return value as TeamRole;
}

export function readInviteRole(body: unknown, field: string): InviteRole {
  const value = readString(body, field);

  if (!INVITE_ROLES.includes(value as InviteRole)) {
    throw new AppError(400, 'Owner через инвайт не выдаётся');
  }

  return value as InviteRole;
}

export function readNonOwnerRole(body: unknown, field: string): InviteRole {
  const value = readString(body, field);

  if (!INVITE_ROLES.includes(value as InviteRole)) {
    throw new AppError(400, 'Роль Owner так не назначается');
  }

  return value as InviteRole;
}

export function readBoardBackground(
  body: unknown,
  field: string,
): BoardBackground {
  const value = readString(body, field);

  if (!BOARD_BACKGROUNDS.includes(value as BoardBackground)) {
    throw new AppError(400, 'Некорректный фон доски');
  }

  return value as BoardBackground;
}

export function readLabelColor(body: unknown, field: string): LabelColor {
  const value = readString(body, field);

  if (!LABEL_COLORS.includes(value as LabelColor)) {
    throw new AppError(400, 'Некорректный цвет метки');
  }

  return value as LabelColor;
}

export function readPeriod(value: unknown): AnalyticsPeriod {
  if (typeof value !== 'string' || !ANALYTICS_PERIODS.includes(value as AnalyticsPeriod)) {
    throw new AppError(
      400,
      'Период: today, 7d, 30d, quarter, year, 3y или 5y',
    );
  }

  return value as AnalyticsPeriod;
}

export function readOptionalDate(
  body: unknown,
  field: string,
): Date | undefined {
  const value = readOptionalString(body, field);

  if (!value) {
    return undefined;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new AppError(400, `Некорректная дата ${field}`);
  }

  return date;
}

export function readBoolean(body: unknown, field: string): boolean {
  if (typeof body !== 'object' || body === null) {
    throw new AppError(400, 'Некорректное тело запроса');
  }

  const value = (body as Record<string, unknown>)[field];

  if (typeof value !== 'boolean') {
    throw new AppError(400, `Поле ${field} должно быть boolean`);
  }

  return value;
}

export function isFeatureOn(value: boolean | undefined): boolean {
  return value === true;
}

export function assertFeatureOn(
  value: boolean | undefined,
  message: string,
): void {
  if (!isFeatureOn(value)) {
    throw new AppError(403, message);
  }
}

export function assertRole(
  role: TeamRole,
  allowed: TeamRole[],
  message = 'Недостаточно прав',
): void {
  if (!allowed.includes(role)) {
    throw new AppError(403, message);
  }
}
