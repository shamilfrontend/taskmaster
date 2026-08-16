export type TeamRole = 'owner' | 'admin' | 'member' | 'viewer';
export type InviteRole = 'admin' | 'member' | 'viewer';
export type ReleaseStatus = 'planned' | 'released';
export type LabelColor = 'blue' | 'green' | 'purple' | 'pink' | 'amber';
export type AnalyticsPeriod =
  | 'today'
  | '7d'
  | '30d'
  | 'quarter'
  | 'year'
  | '3y'
  | '5y';
export type AnalyticsRiskKind = 'overdue' | 'dueSoon' | 'gaps';
export type BoardBackgroundId =
  | 'default'
  | 'bg-01'
  | 'bg-02'
  | 'bg-03'
  | 'bg-04'
  | 'bg-05'
  | 'bg-06'
  | 'bg-07'
  | 'bg-08'
  | 'bg-09'
  | 'bg-10'
  | 'bg-11'
  | 'bg-12'
  | 'bg-13'
  | 'bg-14'
  | 'bg-15'
  | 'bg-16'
  | 'bg-17'
  | 'bg-18'
  | 'bg-19'
  | 'bg-20'
  | 'bg-21'
  | 'bg-22'
  | 'bg-23'
  | 'bg-24'
  | 'bg-25'
  | 'bg-26'
  | 'bg-27'
  | 'bg-28'
  | 'bg-29'
  | 'bg-30'
  | 'bg-31'
  | 'bg-32'
  | 'bg-33'
  | 'bg-34'
  | 'bg-35'
  | 'bg-36';

export interface AuthUser {
  id: string;
  displayName: string;
  email: string;
  avatarUrl: string;
  isDemo: boolean;
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
  budgetEnabled: boolean;
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

export type ActivityKind = 'card_created' | 'card_moved' | 'comment_added';

export interface ActivityItem {
  id: string;
  kind: ActivityKind;
  cardId: string;
  cardTitle: string;
  detail: string;
  boardId: string;
  projectId: string;
  actorId: string;
  actorName: string;
  createdAt: string;
}

export interface TeamActivityPage {
  items: ActivityItem[];
  hasMore: boolean;
}

export interface InvitePreview {
  teamName: string;
  role: InviteRole;
  expiresAt: string;
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
  releasesEnabled: boolean;
  budgetEnabled: boolean;
  boardBackground: BoardBackgroundId;
  budgetLimit?: number;
  fact?: number;
  remainder?: number;
  roleRates?: Record<TeamRole, number>;
  rates: ProjectRateRow[];
  board: { id: string };
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
  commentCount: number;
  checklistDone: number;
  checklistTotal: number;
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

export interface ChecklistItem {
  id: string;
  text: string;
  done: boolean;
  position: number;
}

export interface CardChecklist {
  id: string;
  title: string;
  position: number;
  items: ChecklistItem[];
}

export interface CardDetails {
  id: string;
  boardId: string;
  columnId: string;
  title: string;
  description: string;
  assigneeId: string | null;
  dueDate: string | null;
  estimateHours: number;
  releaseId: string | null;
  labelIds: string[];
  checklists: CardChecklist[];
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
  releasesEnabled: boolean;
  budgetEnabled: boolean;
  summary: {
    cards: number;
    overdue: number;
    noAssignee: number;
    noEstimate: number;
    noRelease?: number;
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
  weeks: { from: string; to: string; hours: number; amount?: number }[];
  risks: {
    cardId: string;
    title: string;
    kind: AnalyticsRiskKind;
    detail: string;
  }[];
}

export interface ApiErrorBody {
  error?: string;
}
