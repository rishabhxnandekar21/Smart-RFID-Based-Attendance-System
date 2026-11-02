import { Student } from '../models/Student.js';
import { Attendance } from '../models/Attendance.js';
import { ScanEvent } from '../models/ScanEvent.js';
import { Device } from '../models/Device.js';

// Cache recent eventIds to avoid network duplicate replay within 60s
const processedEvents = new Map();

function cleanOldEvents() {
  const now = Date.now();
  for (const [id, time] of processedEvents.entries()) {
    if (now - time > 60000) {
      processedEvents.delete(id);
    }
  }
}
setInterval(cleanOldEvents, 30000);

export async function updateDeviceActivity(deviceId, socketIo = null) {
  if (!deviceId) return;
  try {
    const updated = await Device.findOneAndUpdate(
      { deviceId },
      {
        $set: {
          deviceId,
          isOnline: true,
          lastSeen: new Date(),
        },
      },
      { upsert: true, new: true }
    );

    if (socketIo) {
      socketIo.emit('device-status', {
        deviceId: updated.deviceId,
        isOnline: true,
        lastSeen: updated.lastSeen.toISOString(),
      });
    }
  } catch (err) {
    console.error(`[Device Update] Error updating device ${deviceId}:`, err.message);
  }
}

/**
 * Shared attendance processing logic used by both MQTT handler and REST test-scan endpoint.
 * Enforces atomic database-backed 10-second cooldown per RFID UID.
 */
export async function processRfidScan({
  uid,
  deviceId = 'ESP32_01',
  eventId,
  socketIo = null,
  mqttPublish = null,
}) {
  const cleanUid = (uid || '').trim().toUpperCase();
  const validEventId = eventId || `scan-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const now = new Date();

  // Deduplication check for same event ID
  if (processedEvents.has(validEventId)) {
    console.log(`[Attendance Service] Duplicate eventId ignored: ${validEventId}`);
    return processedEvents.get(validEventId);
  }

  // Update device active status
  await updateDeviceActivity(deviceId, socketIo);

  if (!cleanUid) {
    const errorResult = {
      eventId: validEventId,
      uid: '',
      status: 'unknown',
      studentName: 'Invalid Scan',
      studentId: null,
      deviceId,
      timestamp: now.toISOString(),
      message: 'No RFID UID provided.',
    };
    return errorResult;
  }

  const cooldownSeconds = parseInt(process.env.ATTENDANCE_COOLDOWN_SECONDS, 10) || 10;
  const cooldownMs = cooldownSeconds * 1000;
  const cooldownThreshold = new Date(now.getTime() - cooldownMs);

  // 1. Identify student in MongoDB
  const student = await Student.findOne({ rfidUid: cleanUid });

  // If unregistered / unknown card
  if (!student) {
    console.log(`[Attendance Service] UNKNOWN RFID card scanned: ${cleanUid}`);

    await ScanEvent.create({
      eventId: validEventId,
      uid: cleanUid,
      student: null,
      studentName: 'Unknown RFID Card',
      studentId: null,
      deviceId,
      timestamp: now,
      status: 'unknown',
      remainingSeconds: 0,
      message: 'Unknown RFID card.',
    });

    const unknownResult = {
      eventId: validEventId,
      uid: cleanUid,
      status: 'unknown',
      studentName: 'Unknown RFID Card',
      studentId: null,
      deviceId,
      timestamp: now.toISOString(),
      message: 'This RFID card is not registered in the system.',
    };

    processedEvents.set(validEventId, unknownResult);

    if (socketIo) {
      socketIo.emit('scan-event', unknownResult);
    }

    if (mqttPublish && deviceId) {
      mqttPublish(`attendance/${deviceId}/result`, {
        eventId: validEventId,
        uid: cleanUid,
        status: 'unknown',
        message: 'Unknown RFID card',
      });
    }

    return unknownResult;
  }

  // 2. Student is registered: Perform atomic database-backed cooldown test & update
  // Conditional atomic update: only update if lastAttendanceTimestamp is null OR <= cooldownThreshold
  const updatedStudent = await Student.findOneAndUpdate(
    {
      _id: student._id,
      $or: [
        { lastAttendanceTimestamp: null },
        { lastAttendanceTimestamp: { $lte: cooldownThreshold } },
      ],
    },
    {
      $set: { lastAttendanceTimestamp: now },
      $inc: { totalAttendance: 1 },
    },
    { new: true }
  );

  // 3. If atomic update failed to match, student is currently on COOLDOWN (duplicate scan)
  if (!updatedStudent) {
    const currentStudent = await Student.findById(student._id);
    const lastTimestamp = currentStudent.lastAttendanceTimestamp
      ? new Date(currentStudent.lastAttendanceTimestamp).getTime()
      : 0;
    const elapsedMs = now.getTime() - lastTimestamp;
    const remainingMs = Math.max(0, cooldownMs - elapsedMs);
    const remainingSeconds = Math.max(1, Math.ceil(remainingMs / 1000));

    console.log(
      `[Attendance Service] DUPLICATE scan for ${student.name} (${cleanUid}). Remaining: ${remainingSeconds}s`
    );

    // Record duplicate attempt without creating attendance record
    await Student.updateOne({ _id: student._id }, { $inc: { totalDuplicates: 1 } });

    await ScanEvent.create({
      eventId: validEventId,
      uid: cleanUid,
      student: student._id,
      studentName: student.name,
      studentId: student.studentId,
      deviceId,
      timestamp: now,
      status: 'duplicate',
      remainingSeconds,
      message: 'Please wait before scanning this card again.',
    });

    const duplicateResult = {
      eventId: validEventId,
      uid: cleanUid,
      status: 'duplicate',
      studentName: student.name,
      studentId: student.studentId,
      deviceId,
      timestamp: now.toISOString(),
      remainingSeconds,
      message: 'Please wait before scanning again.',
    };

    processedEvents.set(validEventId, duplicateResult);

    if (socketIo) {
      socketIo.emit('scan-event', duplicateResult);
      socketIo.emit('cooldown-update', {
        studentId: student.studentId,
        rfidUid: cleanUid,
        cooldownSeconds,
        remainingSeconds,
        active: true,
        startTimestamp: currentStudent.lastAttendanceTimestamp.toISOString(),
      });
    }

    if (mqttPublish && deviceId) {
      mqttPublish(`attendance/${deviceId}/result`, {
        eventId: validEventId,
        uid: cleanUid,
        status: 'duplicate',
        remainingSeconds,
        message: 'Please wait before scanning again',
      });
    }

    return duplicateResult;
  }

  // 4. Cooldown check passed! Record successful attendance.
  const dateStr = now.toISOString().split('T')[0];

  const attendanceRecord = await Attendance.create({
    student: updatedStudent._id,
    studentName: updatedStudent.name,
    studentId: updatedStudent.studentId,
    rfidUid: cleanUid,
    deviceId,
    timestamp: now,
    date: dateStr,
    status: 'Present',
  });

  await ScanEvent.create({
    eventId: validEventId,
    uid: cleanUid,
    student: updatedStudent._id,
    studentName: updatedStudent.name,
    studentId: updatedStudent.studentId,
    deviceId,
    timestamp: now,
    status: 'success',
    remainingSeconds: cooldownSeconds,
    message: 'Attendance marked successfully.',
  });

  console.log(
    `[Attendance Service] SUCCESS: Attendance recorded for ${updatedStudent.name} (${updatedStudent.studentId})`
  );

  const successResult = {
    eventId: validEventId,
    uid: cleanUid,
    status: 'success',
    studentName: updatedStudent.name,
    studentId: updatedStudent.studentId,
    timestamp: now.toISOString(),
    deviceId,
    attendanceId: attendanceRecord._id,
    cooldownSeconds,
    remainingSeconds: cooldownSeconds,
    message: 'Attendance marked successfully.',
  };

  processedEvents.set(validEventId, successResult);

  // Emit real-time events via Socket.IO
  if (socketIo) {
    socketIo.emit('attendance-update', {
      _id: attendanceRecord._id,
      student: updatedStudent._id,
      studentName: updatedStudent.name,
      studentId: updatedStudent.studentId,
      rfidUid: cleanUid,
      deviceId,
      timestamp: now.toISOString(),
      date: dateStr,
      status: 'Present',
    });

    socketIo.emit('scan-event', successResult);

    socketIo.emit('cooldown-update', {
      studentId: updatedStudent.studentId,
      rfidUid: cleanUid,
      cooldownSeconds,
      remainingSeconds: cooldownSeconds,
      active: true,
      startTimestamp: now.toISOString(),
    });
  }

  // Publish MQTT response to ESP32
  if (mqttPublish && deviceId) {
    mqttPublish(`attendance/${deviceId}/result`, {
      eventId: validEventId,
      uid: cleanUid,
      status: 'success',
      studentName: updatedStudent.name,
      studentId: updatedStudent.studentId,
      message: 'Attendance marked successfully',
    });
  }

  return successResult;
}

/**
 * Returns current cooldown status for all students or a specific UID
 */
export async function getCooldownStatuses() {
  const cooldownSeconds = parseInt(process.env.ATTENDANCE_COOLDOWN_SECONDS, 10) || 10;
  const cooldownMs = cooldownSeconds * 1000;
  const now = Date.now();

  const students = await Student.find({}, 'studentId name rfidUid lastAttendanceTimestamp');

  return students.map((s) => {
    let remainingSeconds = 0;
    let isCooldownActive = false;

    if (s.lastAttendanceTimestamp) {
      const elapsed = now - new Date(s.lastAttendanceTimestamp).getTime();
      if (elapsed < cooldownMs) {
        isCooldownActive = true;
        remainingSeconds = Math.max(1, Math.ceil((cooldownMs - elapsed) / 1000));
      }
    }

    return {
      studentId: s.studentId,
      name: s.name,
      rfidUid: s.rfidUid,
      isCooldownActive,
      remainingSeconds,
      lastAttendanceTimestamp: s.lastAttendanceTimestamp,
    };
  });
}
