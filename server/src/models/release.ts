import mongoose, { Schema } from 'mongoose';
import { RELEASE_STATUSES, type ReleaseStatus } from '../constants.js';

export interface ReleasePojo {
  _id: mongoose.Types.ObjectId;
  projectId: mongoose.Types.ObjectId;
  name: string;
  nameNormalized: string;
  date: Date | null;
  status: ReleaseStatus;
}

const releaseSchema = new Schema<ReleasePojo>(
  {
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true },
    name: { type: String, required: true },
    nameNormalized: { type: String, required: true },
    date: { type: Date, default: null },
    status: { type: String, enum: RELEASE_STATUSES, required: true, default: 'planned' }
  },
  { timestamps: true }
);

releaseSchema.index({ projectId: 1, nameNormalized: 1 }, { unique: true });

export const ReleaseModel = mongoose.model<ReleasePojo>('Release', releaseSchema);
