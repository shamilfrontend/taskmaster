import mongoose, { Schema } from 'mongoose';

export interface ChecklistItemPojo {
  _id?: mongoose.Types.ObjectId;
  text: string;
  done: boolean;
  position: number;
}

export interface ChecklistPojo {
  _id?: mongoose.Types.ObjectId;
  title: string;
  position: number;
  items: ChecklistItemPojo[];
}

export interface CardPojo {
  _id: mongoose.Types.ObjectId;
  boardId: mongoose.Types.ObjectId;
  columnId: mongoose.Types.ObjectId;
  title: string;
  description: string;
  assigneeId: mongoose.Types.ObjectId | null;
  dueDate: Date | null;
  estimateHours: number;
  releaseId: mongoose.Types.ObjectId | null;
  labelIds: mongoose.Types.ObjectId[];
  checklists: ChecklistPojo[];
  position: number;
  planAmount: number;
}

const checklistItemSchema = new Schema<ChecklistItemPojo>(
  {
    text: { type: String, required: true },
    done: { type: Boolean, required: true, default: false },
    position: { type: Number, required: true },
  },
  { _id: true },
);

const checklistSchema = new Schema<ChecklistPojo>(
  {
    title: { type: String, required: true },
    position: { type: Number, required: true },
    items: { type: [checklistItemSchema], default: [] },
  },
  { _id: true },
);

const cardSchema = new Schema<CardPojo>(
  {
    boardId: { type: Schema.Types.ObjectId, ref: 'Board', required: true },
    columnId: { type: Schema.Types.ObjectId, ref: 'Column', required: true },
    title: { type: String, required: true },
    description: { type: String, default: '' },
    assigneeId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    dueDate: { type: Date, default: null },
    estimateHours: { type: Number, required: true, default: 0 },
    releaseId: { type: Schema.Types.ObjectId, ref: 'Release', default: null },
    labelIds: [{ type: Schema.Types.ObjectId, ref: 'Label' }],
    checklists: { type: [checklistSchema], default: [] },
    position: { type: Number, required: true },
    planAmount: { type: Number, required: true, default: 0 },
  },
  { timestamps: true },
);

cardSchema.pre('save', function normalizeCard(next) {
  if (this.description == null) {
    this.description = '';
  }

  if (!Array.isArray(this.checklists)) {
    this.checklists = [];
  }

  next();
});

cardSchema.index({ boardId: 1, columnId: 1, position: 1 });
cardSchema.index({ releaseId: 1 });
cardSchema.index({ assigneeId: 1 });

export const CardModel = mongoose.model<CardPojo>('Card', cardSchema);
