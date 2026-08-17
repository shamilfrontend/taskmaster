import mongoose, { Schema } from 'mongoose';

export interface BoardPojo {
  _id: mongoose.Types.ObjectId;
  projectId: mongoose.Types.ObjectId;
  name: string;
}

const boardSchema = new Schema<BoardPojo>(
  {
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true },
    name: { type: String, required: true },
  },
  { timestamps: true },
);

boardSchema.index({ projectId: 1 });

export const BoardModel = mongoose.model<BoardPojo>('Board', boardSchema);
