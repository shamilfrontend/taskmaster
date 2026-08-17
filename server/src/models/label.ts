import mongoose, { Schema } from 'mongoose';
import { LABEL_COLORS, type LabelColor } from '../constants.js';

export interface LabelPojo {
  _id: mongoose.Types.ObjectId;
  boardId: mongoose.Types.ObjectId;
  name: string;
  color: LabelColor;
}

const labelSchema = new Schema<LabelPojo>(
  {
    boardId: { type: Schema.Types.ObjectId, ref: 'Board', required: true },
    name: { type: String, required: true },
    color: { type: String, enum: LABEL_COLORS, required: true },
  },
  { timestamps: true },
);

labelSchema.index({ boardId: 1 });

export const LabelModel = mongoose.model<LabelPojo>('Label', labelSchema);
