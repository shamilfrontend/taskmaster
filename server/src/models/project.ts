import mongoose, { Schema } from 'mongoose';
import {
  DEFAULT_BOARD_BACKGROUND,
  type BoardBackground,
} from '../constants.js';

export interface ProjectPojo {
  _id: mongoose.Types.ObjectId;
  teamId: mongoose.Types.ObjectId;
  name: string;
  releasesEnabled: boolean;
  analyticsEnabled: boolean;
  boardBackground: BoardBackground;
}

const projectSchema = new Schema<ProjectPojo>(
  {
    teamId: { type: Schema.Types.ObjectId, ref: 'Team', required: true },
    name: { type: String, required: true },
    releasesEnabled: { type: Boolean, required: true, default: false },
    analyticsEnabled: { type: Boolean, required: true, default: false },
    boardBackground: {
      type: String,
      required: true,
      default: DEFAULT_BOARD_BACKGROUND,
    },
  },
  { timestamps: true },
);

projectSchema.index({ teamId: 1 });

export const ProjectModel = mongoose.model<ProjectPojo>('Project', projectSchema);
