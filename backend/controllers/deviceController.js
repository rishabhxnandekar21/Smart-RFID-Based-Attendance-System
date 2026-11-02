import mongoose from 'mongoose';
import { Device } from '../models/Device.js';
import { getMqttStatus } from '../services/mqttService.js';

export async function getHealth(req, res) {
  const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
  const mqttStatus = getMqttStatus();

  res.json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    database: dbStatus,
    mqtt: mqttStatus,
    environment: process.env.NODE_ENV || 'development',
  });
}

export async function getDevicesStatus(req, res) {
  try {
    const timeoutSeconds = parseInt(process.env.DEVICE_HEARTBEAT_TIMEOUT_SECONDS, 10) || 60;
    const timeoutThreshold = new Date(Date.now() - timeoutSeconds * 1000);

    const devices = await Device.find().lean();

    const evaluated = devices.map((dev) => {
      const isStillAlive = dev.lastSeen && new Date(dev.lastSeen) > timeoutThreshold;
      return {
        ...dev,
        isOnline: Boolean(dev.isOnline && isStillAlive),
        heartbeatTimeoutSeconds: timeoutSeconds,
      };
    });

    res.json({
      success: true,
      count: evaluated.length,
      data: evaluated,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
}
