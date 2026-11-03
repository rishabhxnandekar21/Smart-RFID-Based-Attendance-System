import { Student } from '../models/Student.js';
import { Attendance } from '../models/Attendance.js';
import { ScanEvent } from '../models/ScanEvent.js';

export async function getStudents(req, res) {
  try {
    const students = await Student.find().sort({ studentId: 1 }).lean();

    // Enrich each student with their stats
    const enriched = await Promise.all(
      students.map(async (student) => {
        const lastAttendance = await Attendance.findOne({ student: student._id })
          .sort({ timestamp: -1 })
          .lean();

        const totalSuccessful = await Attendance.countDocuments({ student: student._id });
        const totalDuplicates = await ScanEvent.countDocuments({
          student: student._id,
          status: 'duplicate',
        });

        // Calculate cooldown remaining
        const cooldownSeconds = parseInt(process.env.ATTENDANCE_COOLDOWN_SECONDS, 10) || 10;
        const cooldownMs = cooldownSeconds * 1000;
        let isCooldownActive = false;
        let remainingSeconds = 0;

        if (student.lastAttendanceTimestamp) {
          const elapsed = Date.now() - new Date(student.lastAttendanceTimestamp).getTime();
          if (elapsed < cooldownMs) {
            isCooldownActive = true;
            remainingSeconds = Math.max(1, Math.ceil((cooldownMs - elapsed) / 1000));
          }
        }

        return {
          ...student,
          totalAttendance: totalSuccessful,
          totalDuplicates,
          lastAttendance,
          isCooldownActive,
          remainingSeconds,
        };
      })
    );

    res.json({ success: true, count: enriched.length, data: enriched });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
}

export async function getStudentById(req, res) {
  try {
    const { studentId } = req.params;
    const student = await Student.findOne({ studentId: studentId.toUpperCase() }).lean();
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    const attendanceRecords = await Attendance.find({ student: student._id })
      .sort({ timestamp: -1 })
      .limit(20)
      .lean();

    const recentScans = await ScanEvent.find({ student: student._id })
      .sort({ timestamp: -1 })
      .limit(30)
      .lean();

    const totalSuccessful = await Attendance.countDocuments({ student: student._id });
    const totalDuplicates = await ScanEvent.countDocuments({
      student: student._id,
      status: 'duplicate',
    });

    const lastAttendance = attendanceRecords[0] || null;

    res.json({
      success: true,
      data: {
        ...student,
        totalAttendance: totalSuccessful,
        totalDuplicates,
        lastAttendance,
        attendanceHistory: attendanceRecords,
        recentScans,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
}

export async function updateStudentRfid(req, res) {
  try {
    const { studentId } = req.params;
    const { rfidUid } = req.body;
    if (!rfidUid) {
      return res.status(400).json({ success: false, message: 'rfidUid is required' });
    }
    const cleanUid = rfidUid.trim().toUpperCase();

    // Check if another student has this UID
    const existing = await Student.findOne({
      rfidUid: cleanUid,
      studentId: { $ne: studentId.toUpperCase() },
    });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: `RFID UID ${cleanUid} is already assigned to ${existing.name}`,
      });
    }

    const updated = await Student.findOneAndUpdate(
      { studentId: studentId.toUpperCase() },
      { $set: { rfidUid: cleanUid } },
      { new: true }
    );
    if (!updated) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    res.json({
      success: true,
      message: `Assigned RFID UID ${cleanUid} to ${updated.name}`,
      data: updated,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
}
