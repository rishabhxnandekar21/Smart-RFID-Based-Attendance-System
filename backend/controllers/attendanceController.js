import { Attendance } from '../models/Attendance.js';
import { ScanEvent } from '../models/ScanEvent.js';
import { Student } from '../models/Student.js';
import { processRfidScan, getCooldownStatuses } from '../services/attendanceService.js';
import { publishMqttMessage } from '../services/mqttService.js';

export async function getAttendance(req, res) {
  try {
    const limit = parseInt(req.query.limit, 10) || 50;
    const records = await Attendance.find()
      .sort({ timestamp: -1 })
      .limit(limit)
      .populate('student', 'name studentId rfidUid')
      .lean();

    res.json({ success: true, count: records.length, data: records });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
}

export async function getTodayAttendance(req, res) {
  try {
    // Current date in YYYY-MM-DD
    const todayStr = new Date().toISOString().split('T')[0];
    const records = await Attendance.find({ date: todayStr })
      .sort({ timestamp: -1 })
      .limit(20)
      .populate('student', 'name studentId rfidUid')
      .lean();

    res.json({ success: true, count: records.length, date: todayStr, data: records });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
}

export async function getLatestScan(req, res) {
  try {
    const latest = await ScanEvent.findOne()
      .sort({ timestamp: -1 })
      .populate('student', 'name studentId rfidUid')
      .lean();

    res.json({ success: true, data: latest });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
}

export async function getAttendanceByStudent(req, res) {
  try {
    const { studentId } = req.params;
    const student = await Student.findOne({ studentId: studentId.toUpperCase() });
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    const records = await Attendance.find({ student: student._id })
      .sort({ timestamp: -1 })
      .limit(50)
      .lean();

    res.json({ success: true, count: records.length, student, data: records });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
}

export async function getScans(req, res) {
  try {
    const { status, uid, studentId } = req.query;
    const limit = parseInt(req.query.limit, 10) || 50;

    const query = {};
    if (status && status !== 'all') {
      query.status = status;
    }
    if (uid) {
      query.uid = uid.toUpperCase();
    }
    if (studentId) {
      query.studentId = studentId.toUpperCase();
    }

    const scans = await ScanEvent.find(query)
      .sort({ timestamp: -1 })
      .limit(limit)
      .lean();

    res.json({ success: true, count: scans.length, data: scans });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
}

export async function getCooldown(req, res) {
  try {
    const { uid } = req.params;
    const allCooldowns = await getCooldownStatuses();

    if (uid) {
      const match = allCooldowns.find(
        (c) => c.rfidUid.toUpperCase() === uid.trim().toUpperCase()
      );
      if (!match) {
        return res.status(404).json({
          success: false,
          message: 'RFID UID not found among registered students',
          isCooldownActive: false,
          remainingSeconds: 0,
        });
      }
      return res.json({ success: true, data: match });
    }

    res.json({ success: true, data: allCooldowns });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
}

export async function testScan(req, res) {
  try {
    if (process.env.ENABLE_TEST_ENDPOINT === 'false') {
      return res.status(403).json({
        success: false,
        message: 'Simulation endpoint is disabled in configuration',
      });
    }

    const { uid, deviceId = 'SIMULATOR_01', simulatedName } = req.body;
    if (!uid) {
      return res.status(400).json({
        success: false,
        message: 'Missing required field: uid',
      });
    }

    const socketIo = req.app.get('socketIo');

    const result = await processRfidScan({
      uid,
      deviceId,
      simulatedName,
      socketIo,
      mqttPublish: publishMqttMessage,
    });

    const statusCode = result.status === 'success' ? 200 : result.status === 'duplicate' ? 429 : 404;

    res.status(statusCode).json({
      success: result.status === 'success',
      ...result,
    });
  } catch (error) {
    console.error('[Test Scan Error]:', error);
    res.status(500).json({ success: false, message: error.message });
  }
}
