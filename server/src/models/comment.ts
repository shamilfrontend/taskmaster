import mongoose, { Schema } from 'mongoose';

export interface CommentPojo {
  _id: mongoose.Types.ObjectId;
  cardId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  parentId: mongoose.Types.ObjectId | null;
  body: string;
  editedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const commentSchema = new Schema<CommentPojo>(
  {
    cardId: { type: Schema.Types.ObjectId, ref: 'Card', required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    parentId: {
      type: Schema.Types.ObjectId,
      ref: 'Comment',
      default: null,
    },
    body: { type: String, required: true },
    editedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

commentSchema.index({ cardId: 1, createdAt: 1 });

export const CommentModel = mongoose.model<CommentPojo>('Comment', commentSchema);
