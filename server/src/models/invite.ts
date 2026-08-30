import mongoose, { Schema } from 'mongoose';
import { INVITE_ROLES, type InviteRole } from '../constants.js';

export interface InvitePojo {
  _id: mongoose.Types.ObjectId;
  teamId: mongoose.Types.ObjectId;
  projectId: mongoose.Types.ObjectId | null;
  tokenHash: string;
  role: InviteRole;
  createdBy: mongoose.Types.ObjectId;
  expiresAt: Date;
  acceptedAt: Date | null;
  revokedAt: Date | null;
}

const inviteSchema = new Schema<InvitePojo>(
  {
    teamId: { type: Schema.Types.ObjectId, ref: 'Team', required: true },
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', default: null },
    tokenHash: { type: String, required: true, unique: true },
    role: { type: String, enum: INVITE_ROLES, required: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    expiresAt: { type: Date, required: true },
    acceptedAt: { type: Date, default: null },
    revokedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

export const InviteModel = mongoose.model<InvitePojo>('Invite', inviteSchema);
