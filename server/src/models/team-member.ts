import mongoose, { Schema } from 'mongoose';
import { TEAM_ROLES, type TeamRole } from '../constants.js';

export interface TeamMemberPojo {
  _id: mongoose.Types.ObjectId;
  teamId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  role: TeamRole;
}

const teamMemberSchema = new Schema<TeamMemberPojo>(
  {
    teamId: { type: Schema.Types.ObjectId, ref: 'Team', required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    role: { type: String, enum: TEAM_ROLES, required: true }
  },
  { timestamps: true }
);

teamMemberSchema.index({ teamId: 1, userId: 1 }, { unique: true });

export const TeamMemberModel = mongoose.model<TeamMemberPojo>(
  'TeamMember',
  teamMemberSchema
);
