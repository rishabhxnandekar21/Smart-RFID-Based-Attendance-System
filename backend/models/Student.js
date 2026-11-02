import mongoose from 'mongoose';

const studentSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    studentId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
    },
    rfidUid: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
    },
    lastAttendanceTimestamp: {
      type: Date,
      default: null,
    },
    totalAttendance: {
      type: Number,
      default: 0,
    },
    totalDuplicates: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

export const Student = mongoose.model('Student', studentSchema);
