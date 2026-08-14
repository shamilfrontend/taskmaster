import type { TeamRole } from '../constants.js';

interface RateSource {
  roleRates: Record<TeamRole, number>;
  personalAmount: number | null;
  role: TeamRole;
}

export function resolveRate(source: RateSource): number {
  if (source.personalAmount !== null) {
    return source.personalAmount;
  }

  return source.roleRates[source.role] ?? 0;
}

export function calcPlan(estimateHours: number, rate: number): number {
  return Math.round(estimateHours * rate);
}

export function calcAmount(hours: number, rate: number): number {
  return Math.round(hours * rate);
}
