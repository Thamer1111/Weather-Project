import mongoose, { Document, Schema } from 'mongoose';
import { openWeatherConfig } from '../config/openweather';

export interface WeatherDocument extends Document {
  _id: mongoose.Types.ObjectId;
  id: string;
  lat: number;
  lon: number;
  data: mongoose.Schema.Types.Mixed;
  fetchedAt: Date;
  source: 'cache' | 'openweather'; 
}

const WeatherSchema = new Schema<WeatherDocument>(
  {
    lat: { type: Number, required: true },
    lon: { type: Number, required: true },
    data: { type: Schema.Types.Mixed, required: true },
    fetchedAt: {
      type: Date,
      required: true,
      default: Date.now,
      expires: openWeatherConfig.staleCacheToleranceMinutes * 60
    },
    source: { type: String, enum: ['cache', 'openweather'], required: true } 
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

WeatherSchema.index({ lat: 1, lon: 1 }, { unique: true });

WeatherSchema.virtual('id').get(function() {
  return this._id.toHexString();
});

export const WeatherCollection = mongoose.model<WeatherDocument>('Weather', WeatherSchema);
