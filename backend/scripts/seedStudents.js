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
    name: 'Rishabh Nandekar',
    studentId: '23BIT054',
    rfidUid: 'F9663015',
  },
  {
    name: 'Krish Shah',
    studentId: '23BIT282D',
    rfidUid: 'E5F6A7B8',
  },
  {
    name: 'Pal Patel',
    studentId: '23BIT066',
    rfidUid: 'C9D0E1F2',
  },
  {
    name: 'Krisha Desai',
    studentId: '23BIT063',
    rfidUid: 'B3C4D5E6',
  },
];

export async function seedStudents() {
  try {
    const validStudentIds = SAMPLE_STUDENTS.map((s) => s.studentId);
    
    // Remove previous sample students that are not in the new 4-student list
    await Student.deleteMany({ studentId: { $nin: validStudentIds } });

    for (const studentData of SAMPLE_STUDENTS) {
      await Student.findOneAndUpdate(
        { studentId: studentData.studentId },
        {
          $set: {
            name: studentData.name,
            studentId: studentData.studentId,
            rfidUid: studentData.rfidUid.toUpperCase(),
          },
          $setOnInsert: {
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

    console.log('[Seed] 4 registered students and default device checked/initialized.');
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
