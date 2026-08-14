import mongoose, { Schema } from 'mongoose';

export interface CardPojo {
  _id: mongoose.Types.ObjectId;
  boardId: mongoose.Types.ObjectId;
  columnId: mongoose.Types.ObjectId;
  title: string;
  assigneeId: mongoose.Types.ObjectId | null;
  dueDate: Date | null;
  estimateHours: number;
  releaseId: mongoose.Types.ObjectId | null;
  labelIds: mongoose.Types.ObjectId[];
  position: number;
  planAmount: number;
}

const cardSchema = new Schema<CardPojo>(
  {
    boardId: { type: Schema.Types.ObjectId, ref: 'Board', required: true },
    columnId: { type: Schema.Types.ObjectId, ref: 'Column', required: true },
    title: { type: String, required: true },
    assigneeId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    dueDate: { type: Date, default: null },
    estimateHours: { type: Number, required: true, default: 0 },
    releaseId: { type: Schema.Types.ObjectId, ref: 'Release', default: null },
    labelIds: [{ type: Schema.Types.ObjectId, ref: 'Label' }],
    position: { type: Number, required: true },
    planAmount: { type: Number, required: true, default: 0 }
  },
  { timestamps: true }
);

cardSchema.index({ boardId: 1, columnId: 1, position: 1 });
cardSchema.index({ releaseId: 1 });
cardSchema.index({ assigneeId: 1 });

export const CardModel = mongoose.model<CardPojo>('Card', cardSchema);
