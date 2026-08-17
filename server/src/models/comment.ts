import mongoose, { Schema } from 'mongoose';

export interface CommentPojo {
  _id: mongoose.Types.ObjectId;
  cardId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  body: string;
  createdAt: Date;
}

const commentSchema = new Schema<CommentPojo>(
  {
    cardId: { type: Schema.Types.ObjectId, ref: 'Card', required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    body: { type: String, required: true },
  },
  { timestamps: true },
);

commentSchema.index({ cardId: 1, createdAt: 1 });

export const CommentModel = mongoose.model<CommentPojo>('Comment', commentSchema);
