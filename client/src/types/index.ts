export type TeamRole = 'owner' | 'admin' | 'member' | 'viewer';
export type InviteRole = 'admin' | 'member' | 'viewer';
export type ReleaseStatus = 'planned' | 'released';
export type LabelColor = 'blue' | 'green' | 'purple' | 'pink' | 'amber';
export type AnalyticsPeriod = '7d' | '30d' | 'quarter';

export interface AuthUser {
  id: string;
  displayName: string;
  email: string;
  avatarUrl: string;
}

export interface TeamListItem {
  id: string;
  name: string;
  role: TeamRole;
  memberCount: number;
  projectCount: number;
}

export interface TeamMember {
  userId: string;
  role: TeamRole;
  displayName: string;
  email: string;
  avatarUrl: string;
}

export interface TeamProject {
  id: string;
  name: string;
  budgetLimit?: number;
}

export interface TeamInvite {
  id: string;
  role: InviteRole;
  expiresAt: string;
}

export interface TeamDetails {
  id: string;
  name: string;
  role: TeamRole;
  members: TeamMember[];
  projects: TeamProject[];
  invites: TeamInvite[];
}

export interface InvitePreview {
  teamName: string;
  role: InviteRole;
  expiresAt: string;
}

export interface ProjectBoard {
  id: string;
  name: string;
  columnCount: number;
  cardCount: number;
}

export interface ProjectRelease {
  id: string;
  name: string;
  date: string | null;
  status: ReleaseStatus;
  cardCount: number;
}

export interface ProjectRateRow {
  userId: string;
  displayName: string;
  role: TeamRole;
  source?: string;
  amount?: number;
}

export interface ProjectDetails {
  id: string;
  teamId: string;
  name: string;
  role: TeamRole;
  budgetLimit?: number;
  fact?: number;
  remainder?: number;
  roleRates?: Record<TeamRole, number>;
  rates: ProjectRateRow[];
  boards: ProjectBoard[];
  releases: ProjectRelease[];
}

export interface BoardColumn {
  id: string;
  name: string;
  position: number;
  isDone: boolean;
}

export interface BoardLabel {
  id: string;
  name: string;
  color: LabelColor;
}

export interface BoardCard {
  id: string;
  columnId: string;
  title: string;
  assigneeId: string | null;
  assigneeName: string | null;
  dueDate: string | null;
  estimateHours: number;
  factHours: number;
  planAmount?: number;
  factAmount?: number;
  releaseId: string | null;
  releaseName: string | null;
  labelIds: string[];
  position: number;
}

export interface BoardDetails {
  id: string;
  projectId: string;
  name: string;
  role: TeamRole;
  columns: BoardColumn[];
  labels: BoardLabel[];
  releases: { id: string; name: string; status: ReleaseStatus }[];
  cards: BoardCard[];
}

export interface TimeEntry {
  id: string;
  userId: string;
  displayName: string;
  hours: number;
  rateSnapshot?: number;
  amount?: number;
  workedAt: string;
}

export interface CardComment {
  id: string;
  userId: string;
  displayName: string;
  body: string;
  createdAt?: string;
}

export interface CardDetails {
  id: string;
  boardId: string;
  columnId: string;
  title: string;
  assigneeId: string | null;
  dueDate: string | null;
  estimateHours: number;
  releaseId: string | null;
  labelIds: string[];
  planAmount?: number;
  timeEntries: TimeEntry[];
  comments: CardComment[];
}

export interface ReleaseDetails {
  id: string;
  projectId: string;
  name: string;
  date: string | null;
  status: ReleaseStatus;
  role: TeamRole;
  cards: {
    id: string;
    title: string;
    boardName: string;
    columnName: string;
    assigneeName: string | null;
  }[];
}

export interface AnalyticsPayload {
  period: AnalyticsPeriod;
  from: string;
  to: string;
  role: TeamRole;
  summary: {
    cards: number;
    overdue: number;
    noAssignee: number;
    noEstimate: number;
    noRelease: number;
    factAmount?: number;
  };
  byStatus: { columnId: string; name: string; count: number }[];
  planVsFact: {
    planHours: number;
    factHours: number;
    planAmount?: number;
    factAmount?: number;
  };
  burn?: {
    limit?: number;
    totalFact?: number;
    remainder: number;
  };
  workload: {
    userId: string;
    displayName: string;
    hours: number;
    amount?: number;
  }[];
  releases: {
    id: string | null;
    name: string;
    status: ReleaseStatus | null;
    done: number;
    total: number;
    planHours: number;
    factHours: number;
  }[];
  weeks: { from: string; to: string; amount?: number }[];
  risks: { cardId: string; title: string; kind: string; detail: string }[];
}

export interface ApiErrorBody {
  error?: string;
}
