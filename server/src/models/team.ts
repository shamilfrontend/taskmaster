import mongoose, { Schema } from 'mongoose';

export interface TeamPojo {
  _id: mongoose.Types.ObjectId;
  name: string;
}

const teamSchema = new Schema<TeamPojo>(
  {
    name: { type: String, required: true }
  },
  { timestamps: true }
);

export const TeamModel = mongoose.model<TeamPojo>('Team', teamSchema);
