import mongoose, { Schema } from 'mongoose';

export const NOTIFICATION_KINDS = [
  'card_assigned',
  'comment_added',
  'comment_reply',
] as const;

export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];

export interface NotificationPojo {
  _id: mongoose.Types.ObjectId;
  recipientId: mongoose.Types.ObjectId;
  actorId: mongoose.Types.ObjectId;
  kind: NotificationKind;
  teamId: mongoose.Types.ObjectId;
  projectId: mongoose.Types.ObjectId;
  boardId: mongoose.Types.ObjectId;
  cardId: mongoose.Types.ObjectId;
  cardTitle: string;
  detail: string;
  readAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const notificationSchema = new Schema<NotificationPojo>(
  {
    recipientId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    actorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    kind: { type: String, enum: NOTIFICATION_KINDS, required: true },
    teamId: { type: Schema.Types.ObjectId, ref: 'Team', required: true },
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true },
    boardId: { type: Schema.Types.ObjectId, ref: 'Board', required: true },
    cardId: { type: Schema.Types.ObjectId, ref: 'Card', required: true },
    cardTitle: { type: String, required: true },
    detail: { type: String, default: '' },
    readAt: { type: Date, default: null },
  },
  { timestamps: true },
);

notificationSchema.index({ recipientId: 1, createdAt: -1 });
notificationSchema.index({ recipientId: 1, readAt: 1 });
notificationSchema.index({ cardId: 1 });
notificationSchema.index({ boardId: 1 });
notificationSchema.index({ projectId: 1 });
notificationSchema.index({ teamId: 1 });

export const NotificationModel = mongoose.model<NotificationPojo>(
  'Notification',
  notificationSchema,
);
