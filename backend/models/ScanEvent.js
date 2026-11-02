import mongoose from 'mongoose';

const scanEventSchema = new mongoose.Schema(
  {
    eventId: {
      type: String,
      required: true,
      index: true,
    },
    uid: {
      type: String,
      required: true,
      uppercase: true,
      index: true,
    },
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student',
      default: null,
    },
    studentName: {
      type: String,
      default: 'Unknown Student',
    },
    studentId: {
      type: String,
      default: null,
    },
    deviceId: {
      type: String,
      required: true,
      default: 'ESP32_01',
    },
    timestamp: {
      type: Date,
      required: true,
      default: Date.now,
      index: true,
    },
    status: {
      type: String,
      required: true,
      enum: ['success', 'duplicate', 'unknown'],
      index: true,
    },
    remainingSeconds: {
      type: Number,
      default: 0,
    },
    message: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

scanEventSchema.index({ timestamp: -1 });

export const ScanEvent = mongoose.model('ScanEvent', scanEventSchema);
