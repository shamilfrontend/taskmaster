import type { TeamRole } from '../constants.js';

export function canManageMember(actor: TeamRole, target: TeamRole): boolean {
  if (actor === 'owner') {
    return target !== 'owner';
  }

  if (actor === 'admin') {
    return target === 'member' || target === 'viewer';
  }

  return false;
}

export function canEditCards(role: TeamRole): boolean {
  return role === 'owner' || role === 'admin' || role === 'member';
}
