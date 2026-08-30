import mongoose from 'mongoose';
import { AppError } from '../errors/app-error.js';
import { BoardModel } from '../models/board.js';
import { CardModel } from '../models/card.js';
import { ColumnModel } from '../models/column.js';
import { CommentModel } from '../models/comment.js';
import { LabelModel } from '../models/label.js';
import { ProjectMemberModel } from '../models/project-member.js';
import { ProjectModel } from '../models/project.js';
import { ReleaseModel } from '../models/release.js';
import { TeamMemberModel } from '../models/team-member.js';
import { TimeEntryModel } from '../models/time-entry.js';
import { UserModel } from '../models/user.js';
import {
  BOARD_BACKGROUNDS,
  COMMENT_BODY_MAX,
  DEFAULT_BOARD_BACKGROUND,
  DEFAULT_BOARD_NAME,
  LABEL_COLORS,
  RELEASE_STATUSES,
  type BoardBackground,
  type LabelColor,
  type ReleaseStatus,
} from '../constants.js';
import { normalizeName } from '../utils/crypto.js';
import { deleteProjectCascade } from './cascade.js';
import {
  PROJECT_SNAPSHOT_FORMAT,
  PROJECT_SNAPSHOT_VERSION,
  type ProjectSnapshot,
  type SnapshotCard,
  type SnapshotChecklist,
  type SnapshotColumn,
  type SnapshotComment,
  type SnapshotLabel,
  type SnapshotPerson,
  type SnapshotRelease,
  type SnapshotTimeEntry,
} from './project-snapshot.js';

const DESCRIPTION_MAX = 8000;
const CHECKLIST_TITLE_MAX = 200;
const CHECKLIST_ITEM_MAX = 500;
const CARD_BATCH = 100;

export interface ProjectImportResult {
  id: string;
  name: string;
  skippedComments: number;
  skippedTimeEntries: number;
  skippedAssignees: number;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function clip(value: string, max: number): string {
  const trimmed = value.trim();

  if (trimmed.length <= max) {
    return trimmed;
  }

  return trimmed.slice(0, max);
}

function fallbackName(value: string): string {
  return value.trim() || 'Без названия';
}

function parseDate(value: unknown): Date | null {
  if (typeof value !== 'string' || !value) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}

function isHalfStep(value: number): boolean {
  return Math.abs(value * 2 - Math.round(value * 2)) < 1e-9;
}

function normalizeEstimate(value: number): number {
  if (!Number.isFinite(value) || value < 0) {
    return 0;
  }

  const rounded = Math.round(value * 2) / 2;
  return Math.min(1000, Math.max(0, rounded));
}

function normalizeHours(value: number): number | null {
  if (!Number.isFinite(value) || !isHalfStep(value) || value < 0.5 || value > 24) {
    return null;
  }

  return value;
}

function parseId(value: unknown): string | null {
  return typeof value === 'string' && value ? value : null;
}

function parsePerson(value: unknown): SnapshotPerson | null {
  const row = asRecord(value);
  const id = parseId(row?.id);

  if (!row || !id) {
    return null;
  }

  return {
    id,
    email: asString(row.email),
    displayName: asString(row.displayName),
  };
}

function parseColumn(value: unknown): SnapshotColumn | null {
  const row = asRecord(value);
  const id = parseId(row?.id);

  if (!row || !id) {
    return null;
  }

  return {
    id,
    name: fallbackName(asString(row.name)),
    position: asNumber(row.position),
    isDone: row.isDone === true,
  };
}

function parseLabel(value: unknown): SnapshotLabel | null {
  const row = asRecord(value);
  const id = parseId(row?.id);

  if (!row || !id) {
    return null;
  }

  const color = asString(row.color);

  return {
    id,
    name: fallbackName(asString(row.name)),
    color: LABEL_COLORS.includes(color as LabelColor)
      ? (color as LabelColor)
      : 'purple',
  };
}

function parseRelease(value: unknown): SnapshotRelease | null {
  const row = asRecord(value);
  const id = parseId(row?.id);

  if (!row || !id) {
    return null;
  }

  const status = asString(row.status);

  return {
    id,
    name: fallbackName(asString(row.name)),
    date: typeof row.date === 'string' ? row.date : null,
    status: RELEASE_STATUSES.includes(status as ReleaseStatus)
      ? (status as ReleaseStatus)
      : 'planned',
  };
}

function parseChecklist(value: unknown, index: number): SnapshotChecklist {
  const row = asRecord(value);
  const items = Array.isArray(row?.items) ? row.items : [];

  return {
    title: fallbackName(clip(asString(row?.title), CHECKLIST_TITLE_MAX)),
    position: asNumber(row?.position, index),
    items: items.flatMap((item, itemIndex) => {
      const rec = asRecord(item);
      const text = clip(asString(rec?.text), CHECKLIST_ITEM_MAX);

      if (!text) {
        return [];
      }

      return [
        {
          text,
          done: rec?.done === true,
          position: asNumber(rec?.position, itemIndex),
        },
      ];
    }),
  };
}

function parseCard(value: unknown): SnapshotCard | null {
  const row = asRecord(value);
  const id = parseId(row?.id);
  const columnId = parseId(row?.columnId);

  if (!row || !id || !columnId) {
    return null;
  }

  const labelIds = Array.isArray(row.labelIds)
    ? row.labelIds.filter((item): item is string => typeof item === 'string')
    : [];

  return {
    id,
    columnId,
    title: fallbackName(asString(row.title)),
    description: clip(asString(row.description), DESCRIPTION_MAX),
    assigneeId: parseId(row.assigneeId),
    dueDate: typeof row.dueDate === 'string' ? row.dueDate : null,
    estimateHours: normalizeEstimate(asNumber(row.estimateHours)),
    releaseId: parseId(row.releaseId),
    labelIds,
    checklists: Array.isArray(row.checklists)
      ? row.checklists.map((item, index) => parseChecklist(item, index))
      : [],
    position: asNumber(row.position),
    createdAt: typeof row.createdAt === 'string' ? row.createdAt : null,
  };
}

function parseComment(value: unknown): SnapshotComment | null {
  const row = asRecord(value);
  const id = parseId(row?.id);
  const cardId = parseId(row?.cardId);
  const userId = parseId(row?.userId);
  const body = clip(asString(row?.body), COMMENT_BODY_MAX);

  if (!row || !id || !cardId || !userId || !body) {
    return null;
  }

  return {
    id,
    cardId,
    parentId: parseId(row.parentId),
    userId,
    body,
    editedAt: typeof row.editedAt === 'string' ? row.editedAt : null,
    createdAt: typeof row.createdAt === 'string' ? row.createdAt : null,
  };
}

function parseTimeEntry(value: unknown): SnapshotTimeEntry | null {
  const row = asRecord(value);
  const cardId = parseId(row?.cardId);
  const userId = parseId(row?.userId);
  const hours = normalizeHours(asNumber(row?.hours));
  const workedAt = asString(row?.workedAt);

  if (!row || !cardId || !userId || hours === null || !workedAt) {
    return null;
  }

  return {
    cardId,
    userId,
    hours,
    workedAt,
  };
}

function parseList<T>(
  value: unknown,
  parse: (item: unknown) => T | null,
): T[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map(parse).filter((item): item is T => item !== null);
}

function parseSnapshot(value: unknown): ProjectSnapshot {
  const row = asRecord(value);

  if (!row || row.format !== PROJECT_SNAPSHOT_FORMAT) {
    throw new AppError(400, 'Это не экспорт проекта Taskmaster');
  }

  if (row.version !== PROJECT_SNAPSHOT_VERSION) {
    throw new AppError(400, 'Неподдерживаемая версия файла');
  }

  const project = asRecord(row.project);

  if (!project) {
    throw new AppError(400, 'В файле нет данных проекта');
  }

  const background = asString(project.boardBackground);

  return {
    format: PROJECT_SNAPSHOT_FORMAT,
    version: PROJECT_SNAPSHOT_VERSION,
    exportedAt: asString(row.exportedAt) || new Date().toISOString(),
    project: {
      name: fallbackName(asString(project.name)),
      releasesEnabled: project.releasesEnabled === true,
      boardBackground: BOARD_BACKGROUNDS.includes(background as BoardBackground)
        ? (background as BoardBackground)
        : DEFAULT_BOARD_BACKGROUND,
    },
    people: parseList(row.people, parsePerson),
    columns: parseList(row.columns, parseColumn).sort(
      (left, right) => left.position - right.position,
    ),
    labels: parseList(row.labels, parseLabel),
    releases: parseList(row.releases, parseRelease),
    cards: parseList(row.cards, parseCard),
    comments: parseList(row.comments, parseComment),
    timeEntries: parseList(row.timeEntries, parseTimeEntry),
  };
}

async function remapPeople(
  teamId: mongoose.Types.ObjectId,
  people: SnapshotPerson[],
): Promise<Map<string, mongoose.Types.ObjectId>> {
  const members = await TeamMemberModel.find({ teamId }).lean();
  const users = members.length > 0
    ? await UserModel.find({
      _id: { $in: members.map((member) => member.userId) },
    }).lean()
    : [];
  const byId = new Map(users.map((user) => [user._id.toString(), user._id]));
  const byEmail = new Map<string, mongoose.Types.ObjectId>();

  for (const user of users) {
    const email = user.email.trim().toLowerCase();

    if (email && !byEmail.has(email)) {
      byEmail.set(email, user._id);
    }
  }

  const mapped = new Map<string, mongoose.Types.ObjectId>();

  for (const person of people) {
    const match = byId.get(person.id)
      ?? (person.email.trim()
        ? byEmail.get(person.email.trim().toLowerCase())
        : undefined);

    if (match) {
      mapped.set(person.id, match);
    }
  }

  return mapped;
}

export async function importProjectSnapshot(params: {
  teamId: mongoose.Types.ObjectId;
  name: string;
  payload: unknown;
  ownerId: mongoose.Types.ObjectId;
}): Promise<ProjectImportResult> {
  const snapshot = parseSnapshot(params.payload);

  if (snapshot.columns.length === 0) {
    throw new AppError(400, 'В файле нет колонок');
  }

  const peopleMap = await remapPeople(params.teamId, snapshot.people);
  let projectId: mongoose.Types.ObjectId | null = null;

  try {
    const project = await ProjectModel.create({
      teamId: params.teamId,
      name: params.name,
      releasesEnabled: snapshot.project.releasesEnabled,
      boardBackground: snapshot.project.boardBackground,
    });

    projectId = project._id;

    await ProjectMemberModel.create({
      projectId: project._id,
      userId: params.ownerId,
      role: 'owner',
    });

    const board = await BoardModel.create({
      projectId: project._id,
      name: DEFAULT_BOARD_NAME,
    });

    const columnIdByOld = new Map<string, mongoose.Types.ObjectId>();
    await ColumnModel.insertMany(
      snapshot.columns.map((column, index) => {
        const id = new mongoose.Types.ObjectId();
        columnIdByOld.set(column.id, id);

        return {
          _id: id,
          boardId: board._id,
          name: column.name,
          position: index,
          isDone: column.isDone,
        };
      }),
    );

    const labelIdByOld = new Map<string, mongoose.Types.ObjectId>();

    if (snapshot.labels.length > 0) {
      await LabelModel.insertMany(
        snapshot.labels.map((label) => {
          const id = new mongoose.Types.ObjectId();
          labelIdByOld.set(label.id, id);

          return {
            _id: id,
            boardId: board._id,
            name: label.name,
            color: label.color,
          };
        }),
      );
    }

    const releaseIdByOld = new Map<string, mongoose.Types.ObjectId>();
    const releaseIdByName = new Map<string, mongoose.Types.ObjectId>();

    if (snapshot.releases.length > 0) {
      const releaseDocs = snapshot.releases.flatMap((release) => {
        const nameNormalized = normalizeName(release.name);
        const existing = releaseIdByName.get(nameNormalized);

        if (existing) {
          releaseIdByOld.set(release.id, existing);
          return [];
        }

        const id = new mongoose.Types.ObjectId();
        releaseIdByOld.set(release.id, id);
        releaseIdByName.set(nameNormalized, id);

        return [
          {
            _id: id,
            projectId: project._id,
            name: release.name,
            nameNormalized,
            date: parseDate(release.date),
            status: release.status,
          },
        ];
      });

      if (releaseDocs.length > 0) {
        await ReleaseModel.insertMany(releaseDocs);
      }
    }

    const cardIdByOld = new Map<string, mongoose.Types.ObjectId>();
    let skippedAssignees = 0;
    const cardDocs = snapshot.cards.flatMap((card) => {
      const columnId = columnIdByOld.get(card.columnId);

      if (!columnId) {
        return [];
      }

      const id = new mongoose.Types.ObjectId();
      cardIdByOld.set(card.id, id);
      let assigneeId: mongoose.Types.ObjectId | null = null;

      if (card.assigneeId) {
        assigneeId = peopleMap.get(card.assigneeId) ?? null;

        if (!assigneeId) {
          skippedAssignees += 1;
        }
      }

      const createdAt = parseDate(card.createdAt) ?? new Date();

      return [
        {
          _id: id,
          boardId: board._id,
          columnId,
          title: card.title,
          description: card.description,
          assigneeId,
          dueDate: parseDate(card.dueDate),
          estimateHours: card.estimateHours,
          releaseId: card.releaseId
            ? releaseIdByOld.get(card.releaseId) ?? null
            : null,
          labelIds: card.labelIds
            .map((labelId) => labelIdByOld.get(labelId))
            .filter((labelId): labelId is mongoose.Types.ObjectId => Boolean(labelId)),
          checklists: card.checklists.map((checklist) => ({
            title: checklist.title,
            position: checklist.position,
            items: checklist.items.map((item) => ({
              text: item.text,
              done: item.done,
              position: item.position,
            })),
          })),
          position: card.position,
          createdAt,
          updatedAt: createdAt,
        },
      ];
    });

    for (let index = 0; index < cardDocs.length; index += CARD_BATCH) {
      // Sequential batches keep Mongo memory bounded.
      // eslint-disable-next-line no-await-in-loop
      await CardModel.insertMany(cardDocs.slice(index, index + CARD_BATCH));
    }

    const commentIdByOld = new Map<string, mongoose.Types.ObjectId>();
    let skippedComments = 0;
    const roots = snapshot.comments.filter((comment) => !comment.parentId);
    const replies = snapshot.comments.filter((comment) => comment.parentId);

    const commentDocs: {
      _id: mongoose.Types.ObjectId;
      cardId: mongoose.Types.ObjectId;
      userId: mongoose.Types.ObjectId;
      parentId: mongoose.Types.ObjectId | null;
      body: string;
      editedAt: Date | null;
      createdAt: Date;
      updatedAt: Date;
    }[] = [];

    const pushComment = (
      comment: SnapshotComment,
      parentId: mongoose.Types.ObjectId | null,
    ): boolean => {
      const cardId = cardIdByOld.get(comment.cardId);
      const userId = peopleMap.get(comment.userId);

      if (!cardId || !userId) {
        return false;
      }

      const id = new mongoose.Types.ObjectId();
      const createdAt = parseDate(comment.createdAt) ?? new Date();
      commentIdByOld.set(comment.id, id);
      commentDocs.push({
        _id: id,
        cardId,
        userId,
        parentId,
        body: comment.body,
        editedAt: parseDate(comment.editedAt),
        createdAt,
        updatedAt: createdAt,
      });
      return true;
    };

    for (const comment of roots) {
      if (!pushComment(comment, null)) {
        skippedComments += 1;
      }
    }

    for (const comment of replies) {
      const parentId = comment.parentId
        ? commentIdByOld.get(comment.parentId)
        : undefined;

      if (!parentId || !pushComment(comment, parentId)) {
        skippedComments += 1;
      }
    }

    if (commentDocs.length > 0) {
      await CommentModel.insertMany(commentDocs);
    }

    let skippedTimeEntries = 0;
    const timeDocs = snapshot.timeEntries.flatMap((entry) => {
      const cardId = cardIdByOld.get(entry.cardId);
      const userId = peopleMap.get(entry.userId);
      const workedAt = parseDate(entry.workedAt);

      if (!cardId || !userId || !workedAt) {
        skippedTimeEntries += 1;
        return [];
      }

      return [
        {
          cardId,
          userId,
          hours: entry.hours,
          workedAt,
        },
      ];
    });

    if (timeDocs.length > 0) {
      await TimeEntryModel.insertMany(timeDocs);
    }

    return {
      id: project._id.toString(),
      name: project.name,
      skippedComments,
      skippedTimeEntries,
      skippedAssignees,
    };
  } catch (err) {
    if (projectId) {
      try {
        await deleteProjectCascade(projectId);
      } catch (rollbackErr) {
        console.error(rollbackErr);
      }
    }

    throw err;
  }
}
