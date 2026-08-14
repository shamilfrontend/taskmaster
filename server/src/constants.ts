export const TEAM_ROLES = ['owner', 'admin', 'member', 'viewer'] as const;
export type TeamRole = (typeof TEAM_ROLES)[number];

export const INVITE_ROLES = ['admin', 'member', 'viewer'] as const;
export type InviteRole = (typeof INVITE_ROLES)[number];

export const RELEASE_STATUSES = ['planned', 'released'] as const;
export type ReleaseStatus = (typeof RELEASE_STATUSES)[number];

export const LABEL_COLORS = [
  'blue',
  'green',
  'purple',
  'pink',
  'amber'
] as const;
export type LabelColor = (typeof LABEL_COLORS)[number];

export const ANALYTICS_PERIODS = ['7d', '30d', 'quarter'] as const;
export type AnalyticsPeriod = (typeof ANALYTICS_PERIODS)[number];

export const DEFAULT_COLUMNS: { name: string; isDone: boolean }[] = [
  { name: 'К выполнению', isDone: false },
  { name: 'В работе', isDone: false },
  { name: 'Готово', isDone: true }
];

export const DEFAULT_BOARD_NAME = 'Основная';

export const DEFAULT_ROLE_RATES: Record<TeamRole, number> = {
  owner: 0,
  admin: 0,
  member: 0,
  viewer: 0
};
