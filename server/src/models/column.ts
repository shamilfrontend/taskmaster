import mongoose, { Schema } from 'mongoose';

export interface ColumnPojo {
  _id: mongoose.Types.ObjectId;
  boardId: mongoose.Types.ObjectId;
  name: string;
  position: number;
  isDone: boolean;
}

const columnSchema = new Schema<ColumnPojo>(
  {
    boardId: { type: Schema.Types.ObjectId, ref: 'Board', required: true },
    name: { type: String, required: true },
    position: { type: Number, required: true },
    isDone: { type: Boolean, required: true, default: false },
  },
  { timestamps: true },
);

columnSchema.index({ boardId: 1, position: 1 });

export const ColumnModel = mongoose.model<ColumnPojo>('Column', columnSchema);
