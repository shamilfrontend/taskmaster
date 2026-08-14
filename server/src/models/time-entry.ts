import mongoose, { Schema } from 'mongoose';

export interface TimeEntryPojo {
  _id: mongoose.Types.ObjectId;
  cardId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  hours: number;
  rateSnapshot: number;
  amount: number;
  workedAt: Date;
}

const timeEntrySchema = new Schema<TimeEntryPojo>(
  {
    cardId: { type: Schema.Types.ObjectId, ref: 'Card', required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    hours: { type: Number, required: true },
    rateSnapshot: { type: Number, required: true },
    amount: { type: Number, required: true },
    workedAt: { type: Date, required: true }
  },
  { timestamps: true }
);

timeEntrySchema.index({ cardId: 1 });
timeEntrySchema.index({ userId: 1, workedAt: 1 });

export const TimeEntryModel = mongoose.model<TimeEntryPojo>(
  'TimeEntry',
  timeEntrySchema
);
