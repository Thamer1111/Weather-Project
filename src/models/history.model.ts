import mongoose, { Document, Schema } from 'mongoose';

export interface HistoryDocument extends Document {
  _id: mongoose.Types.ObjectId;
  id: string;
  user: mongoose.Types.ObjectId;
  weather: mongoose.Types.ObjectId;
  lat: number;
  lon: number;
  requestedAt: Date;
}

const HistorySchema = new Schema<HistoryDocument>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    weather: { type: Schema.Types.ObjectId, ref: 'Weather', required: true },
    lat: { type: Number, required: true },
    lon: { type: Number, required: true },
    requestedAt: { type: Date, default: Date.now, required: true, index: true },
  },
  {
    timestamps: false,
    toJSON: {
      virtuals: true,
      versionKey: false,
      transform: function (doc, ret) {
        ret.id = ret._id.toHexString();
        delete ret._id;
        return ret;
      },
    },
    toObject: {
      virtuals: true,
      versionKey: false,
      transform: function (doc, ret) {
        ret.id = ret._id.toHexString();
        delete ret._id;
        return ret;
      },
    },
  }
);

HistorySchema.index({ user: 1, requestedAt: -1 });

HistorySchema.virtual('id').get(function() {
  return this._id.toHexString();
});

export const HistoryCollection = mongoose.model<HistoryDocument>('History', HistorySchema);
