import type { BoardBackground, LabelColor, ReleaseStatus } from '../constants.js';

export const PROJECT_SNAPSHOT_FORMAT = 'taskmaster-project';
export const PROJECT_SNAPSHOT_VERSION = 1;

export interface SnapshotPerson {
  id: string;
  email: string;
  displayName: string;
}

export interface SnapshotColumn {
  id: string;
  name: string;
  position: number;
  isDone: boolean;
}

export interface SnapshotLabel {
  id: string;
  name: string;
  color: LabelColor;
}

export interface SnapshotRelease {
  id: string;
  name: string;
  date: string | null;
  status: ReleaseStatus;
}

export interface SnapshotChecklistItem {
  text: string;
  done: boolean;
  position: number;
}

export interface SnapshotChecklist {
  title: string;
  position: number;
  items: SnapshotChecklistItem[];
}

export interface SnapshotCard {
  id: string;
  columnId: string;
  title: string;
  description: string;
  assigneeId: string | null;
  dueDate: string | null;
  estimateHours: number;
  releaseId: string | null;
  labelIds: string[];
  checklists: SnapshotChecklist[];
  position: number;
  createdAt: string | null;
}

export interface SnapshotComment {
  id: string;
  cardId: string;
  parentId: string | null;
  userId: string;
  body: string;
  editedAt: string | null;
  createdAt: string | null;
}

export interface SnapshotTimeEntry {
  cardId: string;
  userId: string;
  hours: number;
  workedAt: string;
}

export interface ProjectSnapshot {
  format: typeof PROJECT_SNAPSHOT_FORMAT;
  version: typeof PROJECT_SNAPSHOT_VERSION;
  exportedAt: string;
  project: {
    name: string;
    releasesEnabled: boolean;
    analyticsEnabled: boolean;
    boardBackground: BoardBackground;
  };
  people: SnapshotPerson[];
  columns: SnapshotColumn[];
  labels: SnapshotLabel[];
  releases: SnapshotRelease[];
  cards: SnapshotCard[];
  comments: SnapshotComment[];
  timeEntries: SnapshotTimeEntry[];
}
