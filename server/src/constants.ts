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
  'amber',
] as const;
export type LabelColor = (typeof LABEL_COLORS)[number];

export const ANALYTICS_PERIODS = [
  'today',
  '7d',
  '30d',
  'quarter',
  'year',
  '3y',
  '5y',
] as const;
export type AnalyticsPeriod = (typeof ANALYTICS_PERIODS)[number];

export const DEFAULT_COLUMNS: { name: string; isDone: boolean }[] = [
  { name: 'К выполнению', isDone: false },
  { name: 'В работе', isDone: false },
  { name: 'На проверке', isDone: false },
  { name: 'Готово', isDone: true },
];

export const DEFAULT_BOARD_NAME = 'Основная';

export const DEFAULT_ROLE_RATES: Record<TeamRole, number> = {
  owner: 0,
  admin: 0,
  member: 0,
  viewer: 0,
};

export const BOARD_BACKGROUNDS = [
  'default',
  'bg-01',
  'bg-02',
  'bg-03',
  'bg-04',
  'bg-05',
  'bg-06',
  'bg-07',
  'bg-08',
  'bg-09',
  'bg-10',
  'bg-11',
  'bg-12',
  'bg-13',
  'bg-14',
  'bg-15',
  'bg-16',
  'bg-17',
  'bg-18',
  'bg-19',
  'bg-20',
  'bg-21',
  'bg-22',
  'bg-23',
  'bg-24',
  'bg-25',
  'bg-26',
  'bg-27',
  'bg-28',
  'bg-29',
  'bg-30',
  'bg-31',
  'bg-32',
  'bg-33',
  'bg-34',
  'bg-35',
  'bg-36',
] as const;
export type BoardBackground = (typeof BOARD_BACKGROUNDS)[number];
export const DEFAULT_BOARD_BACKGROUND: BoardBackground = 'default';
