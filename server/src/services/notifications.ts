import mongoose from 'mongoose';
import {
  NotificationModel,
  type NotificationKind,
} from '../models/notification.js';

const DETAIL_MAX = 120;

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
