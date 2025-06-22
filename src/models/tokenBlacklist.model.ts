import mongoose, { Document, Schema } from 'mongoose';

export interface TokenBlacklistDocument extends Document {
  token: string;
  expiresAt: Date;
}

const TokenBlacklistSchema = new Schema<TokenBlacklistDocument>(
  {
    token: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true, expires: 0 },
  },
  {
    timestamps: false,
    toJSON: {
      transform: (doc, ret) => {
        delete ret._id;
        return ret;
      },
    },
  }
);

export const TokenBlacklistCollection = mongoose.model<TokenBlacklistDocument>('TokenBlacklist', TokenBlacklistSchema);
