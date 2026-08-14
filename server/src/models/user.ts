import mongoose, { Schema } from 'mongoose';

export interface UserPojo {
  _id: mongoose.Types.ObjectId;
  yandexId: string;
  displayName: string;
  email: string;
  avatarUrl: string;
}

const userSchema = new Schema<UserPojo>(
  {
    yandexId: { type: String, required: true, unique: true },
    displayName: { type: String, required: true },
    email: { type: String, required: true, default: '' },
    avatarUrl: { type: String, required: true, default: '' }
  },
  { timestamps: true }
);

export const UserModel = mongoose.model<UserPojo>('User', userSchema);
