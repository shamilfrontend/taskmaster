import mongoose, { Schema } from 'mongoose';
import { TEAM_ROLES, type TeamRole } from '../constants.js';

export interface ProjectMemberPojo {
  _id: mongoose.Types.ObjectId;
  projectId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  role: TeamRole;
}

const projectMemberSchema = new Schema<ProjectMemberPojo>(
  {
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    role: { type: String, enum: TEAM_ROLES, required: true },
  },
  { timestamps: true },
);

projectMemberSchema.index({ projectId: 1, userId: 1 }, { unique: true });

export const ProjectMemberModel = mongoose.model<ProjectMemberPojo>(
  'ProjectMember',
  projectMemberSchema,
);
