import express from 'express';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

import { connectDB } from './config/db.js';
import { seedStudents } from './scripts/seedStudents.js';
import { initMqttClient } from './services/mqttService.js';
import { Device } from './models/Device.js';
import apiRoutes from './routes/api.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env') });

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 5001;
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

// Setup Socket.IO
const io = new SocketIOServer(server, {
  cors: {
    origin: '*', // Allow development and production origins
    methods: ['GET', 'POST'],
  },
});
app.set('socketIo', io);

// Security & Middlewares
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: false,
  })
);

app.use(
  cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

app.use(express.json());

// Rate limiter for general requests (protect against flood)
const limiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 600, // 600 requests per minute
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api', limiter);

// Mount API routes
app.use('/api', apiRoutes);

// Root route
app.get('/', (req, res) => {
  res.json({
    name: 'RFID Attendance Monitor API',
    status: 'online',
    version: '1.0.0',
    documentation: '/api/health',
  });
});

// Socket.IO connection handling
io.on('connection', async (socket) => {
  console.log(`[Socket.IO] Client connected: ${socket.id}`);

  // Send initial device status
  try {
    const devices = await Device.find().lean();
    devices.forEach((dev) => {
      socket.emit('device-status', {
        deviceId: dev.deviceId,
        isOnline: dev.isOnline,
        lastSeen: dev.lastSeen ? dev.lastSeen.toISOString() : null,
      });
    });
  } catch (err) {
    console.error('[Socket.IO] Error fetching initial devices:', err.message);
  }

  socket.on('disconnect', () => {
    console.log(`[Socket.IO] Client disconnected: ${socket.id}`);
  });
});

// Device Heartbeat Watchdog
// Every 15 seconds, check if any active device has timed out
const timeoutSeconds = parseInt(process.env.DEVICE_HEARTBEAT_TIMEOUT_SECONDS, 10) || 60;
setInterval(async () => {
  try {
    const threshold = new Date(Date.now() - timeoutSeconds * 1000);
    const staleDevices = await Device.find({
      isOnline: true,
      lastSeen: { $lt: threshold },
    });

    for (const dev of staleDevices) {
      dev.isOnline = false;
      await dev.save();
      console.log(`[Watchdog] Device ${dev.deviceId} marked OFFLINE (heartbeat timeout).`);
      io.emit('device-status', {
        deviceId: dev.deviceId,
        isOnline: false,
        lastSeen: dev.lastSeen ? dev.lastSeen.toISOString() : null,
      });
    }
  } catch (err) {
    console.error('[Watchdog] Error in device watchdog:', err.message);
  }
}, 15000);

// Start server
async function startServer() {
  await connectDB();
  await seedStudents();

  // Initialize MQTT
  initMqttClient(io);

  server.listen(PORT, () => {
    console.log(`=================================================`);
    console.log(`  RFID Attendance Monitor Backend Server Running `);
    console.log(`  HTTP Port: http://localhost:${PORT}             `);
    console.log(`  Socket.IO: Ready                               `);
    console.log(`=================================================`);
  });
}

startServer().catch((err) => {
  console.error('[Server Startup Failure]:', err);
});
