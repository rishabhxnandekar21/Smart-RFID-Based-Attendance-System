import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { Student } from '../models/Student.js';
import { Device } from '../models/Device.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

export const SAMPLE_STUDENTS = [
  {
    name: 'Rahul Sharma',
    studentId: 'STU001',
    rfidUid: 'A1B2C3D4',
  },
  {
    name: 'Priya Patel',
    studentId: 'STU002',
    rfidUid: 'E5F6A7B8',
  },
  {
    name: 'Arjun Mehta',
    studentId: 'STU003',
    rfidUid: 'C9D0E1F2',
  },
];

export async function seedStudents() {
  try {
    for (const studentData of SAMPLE_STUDENTS) {
      await Student.findOneAndUpdate(
        { studentId: studentData.studentId },
        {
          $setOnInsert: {
            name: studentData.name,
            studentId: studentData.studentId,
            rfidUid: studentData.rfidUid.toUpperCase(),
            lastAttendanceTimestamp: null,
            totalAttendance: 0,
            totalDuplicates: 0,
          },
        },
        { upsert: true, new: true }
      );
    }

    // Also register default ESP32 device if not present
    await Device.findOneAndUpdate(
      { deviceId: 'ESP32_01' },
      {
        $setOnInsert: {
          deviceId: 'ESP32_01',
          deviceName: 'ESP32 Gate RC522 Reader',
          isOnline: false,
          lastSeen: null,
        },
      },
      { upsert: true, new: true }
    );

    console.log('[Seed] Sample students and default device checked/initialized.');
  } catch (error) {
    console.error('[Seed] Error seeding students:', error.message);
  }
}

// If run directly via node scripts/seedStudents.js
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/rfid_attendance';
  mongoose
    .connect(mongoUri)
    .then(async () => {
      console.log('[Seed Script] Connected to MongoDB');
      await seedStudents();
      await mongoose.disconnect();
      console.log('[Seed Script] Completed successfully.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('[Seed Script] Database connection failed:', err);
      process.exit(1);
    });
}
