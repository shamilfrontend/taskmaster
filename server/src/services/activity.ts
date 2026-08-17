import mongoose from 'mongoose';
import {
  ActivityEventModel,
  type ActivityKind,
} from '../models/activity-event.js';

export interface RecordActivityInput {
  teamId: string | mongoose.Types.ObjectId;
  projectId: string | mongoose.Types.ObjectId;
  boardId: string | mongoose.Types.ObjectId;
  cardId: string | mongoose.Types.ObjectId;
  actorId: string | mongoose.Types.ObjectId;
  kind: ActivityKind;
  cardTitle: string;
  detail?: string;
}

export function recordActivity(input: RecordActivityInput): void {
  void ActivityEventModel.create({
    teamId: input.teamId,
    projectId: input.projectId,
    boardId: input.boardId,
    cardId: input.cardId,
    actorId: input.actorId,
    kind: input.kind,
    cardTitle: input.cardTitle,
    detail: input.detail ?? '',
  }).catch((err: unknown) => {
    console.error('Failed to record activity', err);
  });
}
