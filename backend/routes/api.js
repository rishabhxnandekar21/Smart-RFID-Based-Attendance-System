import express from 'express';
import {
  getStudents,
  getStudentById,
} from '../controllers/studentController.js';
import {
  getAttendance,
  getTodayAttendance,
  getLatestScan,
  getAttendanceByStudent,
  getScans,
  getCooldown,
  testScan,
} from '../controllers/attendanceController.js';
import {
  getHealth,
  getDevicesStatus,
} from '../controllers/deviceController.js';

const router = express.Router();

// Health and Device Status
router.get('/health', getHealth);
router.get('/devices/status', getDevicesStatus);

// Students
router.get('/students', getStudents);
router.get('/students/:studentId', getStudentById);

// Attendance
router.get('/attendance', getAttendance);
router.get('/attendance/today', getTodayAttendance);
router.get('/attendance/latest', getLatestScan);
router.get('/attendance/student/:studentId', getAttendanceByStudent);

// Scan History
router.get('/scans', getScans);
router.get('/scans/student/:studentId', (req, res) => {
  req.query.studentId = req.params.studentId;
  return getScans(req, res);
});

// Cooldown
router.get('/cooldown', getCooldown);
router.get('/cooldown/:uid', getCooldown);

// Simulation / Testing
router.post('/attendance/test-scan', testScan);

export default router;
