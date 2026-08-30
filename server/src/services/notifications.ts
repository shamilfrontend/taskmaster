import mongoose from 'mongoose';
import { listAllAccessibleProjectIds } from '../middleware/access.js';
import { BoardModel } from '../models/board.js';
import { CardModel } from '../models/card.js';
import { ColumnModel } from '../models/column.js';
import {
  DUE_NOTIFICATION_KINDS,
  NotificationModel,
  type DueNotificationKind,
  type NotificationKind,
} from '../models/notification.js';
import { ProjectModel } from '../models/project.js';
import { addDays, startOfDay, weekStart } from '../utils/dates.js';
import { asObjectId } from '../utils/validate.js';

const DETAIL_MAX = 120;
const DUE_INSERT_LIMIT = 20;

export interface NotifyUserInput {
  recipientId: string | mongoose.Types.ObjectId;
  actorId: string | mongoose.Types.ObjectId;
  kind: NotificationKind;
  teamId: string | mongoose.Types.ObjectId;
  projectId: string | mongoose.Types.ObjectId;
  boardId: string | mongoose.Types.ObjectId;
  cardId: string | mongoose.Types.ObjectId;
  cardTitle: string;
  detail?: string;
}

function toId(value: string | mongoose.Types.ObjectId): mongoose.Types.ObjectId {
  return typeof value === 'string' ? new mongoose.Types.ObjectId(value) : value;
}

function truncateDetail(value: string): string {
  const trimmed = value.trim();

  if (trimmed.length <= DETAIL_MAX) {
    return trimmed;
  }

  return `${trimmed.slice(0, DETAIL_MAX - 1)}…`;
}

function formatDueDetail(dueDate: Date): string {
  return dueDate.toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function notifyUser(input: NotifyUserInput): void {
  if (toId(input.recipientId).equals(toId(input.actorId))) {
    return;
  }

  void NotificationModel.create({
    recipientId: toId(input.recipientId),
    actorId: toId(input.actorId),
    kind: input.kind,
    teamId: toId(input.teamId),
    projectId: toId(input.projectId),
    boardId: toId(input.boardId),
    cardId: toId(input.cardId),
    cardTitle: input.cardTitle,
    detail: truncateDetail(input.detail ?? ''),
  }).catch((err: unknown) => {
    console.error('Failed to create notification', err);
  });
}

export async function ensureDueNotifications(userId: string): Promise<void> {
  const recipientId = asObjectId(userId);
  const projectIds = await listAllAccessibleProjectIds(userId);

  if (projectIds.length === 0) {
    return;
  }

  const today = startOfDay(new Date());
  const weekEnd = addDays(weekStart(today), 7);
  const boards = await BoardModel.find({ projectId: { $in: projectIds } })
    .lean();

  if (boards.length === 0) {
    return;
  }

  const boardIds = boards.map((board) => board._id);
  const boardById = new Map(
    boards.map((board) => [board._id.toString(), board]),
  );
  const columns = await ColumnModel.find({ boardId: { $in: boardIds } }).lean();
  const doneColumnIds = new Set(
    columns
      .filter((column) => column.isDone)
      .map((column) => column._id.toString()),
  );
  const cards = await CardModel.find({
    assigneeId: recipientId,
    boardId: { $in: boardIds },
    dueDate: { $ne: null, $lt: weekEnd },
  }).lean();

  const candidates: Array<{
    card: (typeof cards)[number];
    kind: DueNotificationKind;
  }> = [];

  cards.forEach((card) => {
    if (!card.dueDate || doneColumnIds.has(card.columnId.toString())) {
      return;
    }

    const due = startOfDay(card.dueDate);

    if (due.getTime() < today.getTime()) {
      candidates.push({ card, kind: 'card_overdue' });
      return;
    }

    if (due.getTime() < weekEnd.getTime()) {
      candidates.push({ card, kind: 'card_due_soon' });
    }
  });

  if (candidates.length === 0) {
    return;
  }

  const cardIds = [...new Set(candidates.map((item) => item.card._id))];
  const existing = await NotificationModel.find({
    recipientId,
    kind: { $in: [...DUE_NOTIFICATION_KINDS] },
    cardId: { $in: cardIds },
    $or: [{ readAt: null }, { createdAt: { $gte: today } }],
  })
    .select({ cardId: 1, kind: 1 })
    .lean();
  const blocked = new Set(
    existing.map((item) => `${item.kind}:${item.cardId.toString()}`),
  );
  const projects = await ProjectModel.find({ _id: { $in: projectIds } })
    .select({ teamId: 1 })
    .lean();
  const projectById = new Map(
    projects.map((project) => [project._id.toString(), project]),
  );
  const docs = candidates.flatMap((item) => {
    const key = `${item.kind}:${item.card._id.toString()}`;

    if (blocked.has(key)) {
      return [];
    }

    const board = boardById.get(item.card.boardId.toString());
    const project = board
      ? projectById.get(board.projectId.toString())
      : undefined;

    if (!board || !project || !item.card.dueDate) {
      return [];
    }

    return [{
      recipientId,
      actorId: null,
      kind: item.kind,
      teamId: project.teamId,
      projectId: board.projectId,
      boardId: board._id,
      cardId: item.card._id,
      cardTitle: item.card.title,
      detail: formatDueDetail(item.card.dueDate),
      readAt: null,
    }];
  }).slice(0, DUE_INSERT_LIMIT);

  if (docs.length > 0) {
    await NotificationModel.insertMany(docs);
  }
}
