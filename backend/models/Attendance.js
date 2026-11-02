import mongoose from 'mongoose';

const attendanceSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student',
      required: true,
    },
    studentName: {
      type: String,
      required: true,
    },
    studentId: {
      type: String,
      required: true,
    },
    rfidUid: {
      type: String,
      required: true,
      uppercase: true,
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
    },
    date: {
      type: String,
      required: true,
      index: true,
    },
    status: {
      type: String,
      required: true,
      default: 'Present',
    },
  },
  {
    timestamps: true,
  }
);

attendanceSchema.index({ timestamp: -1 });
attendanceSchema.index({ studentId: 1, date: 1 });

export const Attendance = mongoose.model('Attendance', attendanceSchema);
