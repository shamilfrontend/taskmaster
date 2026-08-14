import mongoose, { Schema } from 'mongoose';

export interface ProjectMemberRatePojo {
  _id: mongoose.Types.ObjectId;
  projectId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  amount: number;
}

const schema = new Schema<ProjectMemberRatePojo>(
  {
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    amount: { type: Number, required: true }
  },
  { timestamps: true }
);

schema.index({ projectId: 1, userId: 1 }, { unique: true });

export const ProjectMemberRateModel = mongoose.model<ProjectMemberRatePojo>(
  'ProjectMemberRate',
  schema
);
