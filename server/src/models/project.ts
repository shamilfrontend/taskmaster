import mongoose, { Schema } from 'mongoose';
import { TEAM_ROLES, type TeamRole } from '../constants.js';

export interface ProjectPojo {
  _id: mongoose.Types.ObjectId;
  teamId: mongoose.Types.ObjectId;
  name: string;
  budgetLimit: number;
  roleRates: Record<TeamRole, number>;
}

const projectSchema = new Schema<ProjectPojo>(
  {
    teamId: { type: Schema.Types.ObjectId, ref: 'Team', required: true },
    name: { type: String, required: true },
    budgetLimit: { type: Number, required: true, default: 0 },
    roleRates: {
      owner: { type: Number, required: true, default: 0 },
      admin: { type: Number, required: true, default: 0 },
      member: { type: Number, required: true, default: 0 },
      viewer: { type: Number, required: true, default: 0 }
    }
  },
  { timestamps: true }
);

projectSchema.index({ teamId: 1 });

export const ProjectModel = mongoose.model<ProjectPojo>('Project', projectSchema);
