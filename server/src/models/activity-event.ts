import mongoose, { Schema } from 'mongoose';

export const ACTIVITY_KINDS = [
  'card_created',
  'card_moved',
  'comment_added'
] as const;

export type ActivityKind = (typeof ACTIVITY_KINDS)[number];

export interface ActivityEventPojo {
  _id: mongoose.Types.ObjectId;
  teamId: mongoose.Types.ObjectId;
  projectId: mongoose.Types.ObjectId;
  boardId: mongoose.Types.ObjectId;
  cardId: mongoose.Types.ObjectId;
  actorId: mongoose.Types.ObjectId;
  kind: ActivityKind;
  cardTitle: string;
  detail: string;
  createdAt: Date;
}

const activityEventSchema = new Schema<ActivityEventPojo>(
  {
    teamId: { type: Schema.Types.ObjectId, ref: 'Team', required: true },
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true },
    boardId: { type: Schema.Types.ObjectId, ref: 'Board', required: true },
    cardId: { type: Schema.Types.ObjectId, ref: 'Card', required: true },
    actorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    kind: { type: String, enum: ACTIVITY_KINDS, required: true },
    cardTitle: { type: String, required: true },
    detail: { type: String, default: '' }
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

activityEventSchema.index({ teamId: 1, createdAt: -1 });
activityEventSchema.index({ boardId: 1 });

export const ActivityEventModel = mongoose.model<ActivityEventPojo>(
  'ActivityEvent',
  activityEventSchema
);
