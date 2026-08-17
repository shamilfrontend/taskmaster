import mongoose, { Schema } from 'mongoose';
import {
  DEFAULT_BOARD_BACKGROUND,
  type BoardBackground,
  type TeamRole,
} from '../constants.js';

export interface ProjectPojo {
  _id: mongoose.Types.ObjectId;
  teamId: mongoose.Types.ObjectId;
  name: string;
  budgetLimit: number;
  roleRates: Record<TeamRole, number>;
  releasesEnabled: boolean;
  budgetEnabled: boolean;
  boardBackground: BoardBackground;
}

const projectSchema = new Schema<ProjectPojo>(
  {
    teamId: { type: Schema.Types.ObjectId, ref: 'Team', required: true },
    name: { type: String, required: true },
    budgetLimit: { type: Number, required: true, default: 0 },
    releasesEnabled: { type: Boolean, required: true, default: false },
    budgetEnabled: { type: Boolean, required: true, default: false },
    boardBackground: {
      type: String,
      required: true,
      default: DEFAULT_BOARD_BACKGROUND,
    },
    roleRates: {
      owner: { type: Number, required: true, default: 0 },
      admin: { type: Number, required: true, default: 0 },
      member: { type: Number, required: true, default: 0 },
      viewer: { type: Number, required: true, default: 0 },
    },
  },
  { timestamps: true },
);

projectSchema.index({ teamId: 1 });

export const ProjectModel = mongoose.model<ProjectPojo>('Project', projectSchema);
