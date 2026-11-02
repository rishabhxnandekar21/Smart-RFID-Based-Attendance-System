# RFID Attendance Monitor
### Smart IoT Attendance System | ESP32 + RC522 + HiveMQ Cloud + MERN Stack

An end-to-end, lightweight, production-grade IoT attendance monitoring application designed for college hardware demonstrations and IoT proof-of-concepts. 

The system integrates an **ESP32 microcontroller** and **RC522 13.56MHz RFID reader** with a **HiveMQ Cloud MQTT broker**, **Node.js/Express backend**, **MongoDB database**, and **React real-time dashboard** powered by **Socket.IO**.

---

## 🌟 Key Features

- **Hardware-to-Cloud Pipeline**: ESP32 scans RFID tags, converts UIDs to uppercase hexadecimal strings, and publishes scan events via MQTT over TLS (Port 8883) with QoS 1.
- **Atomic 10-Second Cooldown**: Server-side, database-backed cooldown per RFID UID. The same card cannot mark attendance twice within 10 seconds. Concurrent taps are handled atomically using MongoDB conditional updates.
- **Bi-Directional MQTT Feedback**: The backend publishes attendance results back to `attendance/{deviceId}/result`, allowing the ESP32 to blink status LEDs and print confirmed results in Serial Monitor.
- **Instant Real-Time UI Updates**: Socket.IO broadcasts confirmed attendance records, duplicate rejections, and raw scan logs without page refreshes.
- **Interactive Modals & Toasts**:
  - **Success Popup**: Confirmed student details, timestamp, device ID, and auto-dismissal after 3 seconds.
  - **Duplicate Popup**: Yellow warning displaying remaining cooldown in seconds.
  - **Unknown Card Popup**: Red alert for unregistered tags.
- **Dual Table Tracking**:
  - **Today's Attendance**: Valid, successful attendance records only (stored in MongoDB `Attendance` collection).
  - **RFID Scan History**: Comprehensive audit log recording every physical scan attempt (Success, Duplicate, Unknown).
- **Individual Student History**: Click any student card to inspect historical scans, total present count, and rejected duplicate attempts.
- **Hardware Simulation Mode**: 4 one-click simulator buttons on the dashboard allowing end-to-end testing without physical hardware.

---

## 🏗️ Architecture Diagram

```text
+-------------------+           +-------------------+
|  ESP32 + RC522    |   Wi-Fi   |   HiveMQ Cloud    |
|  (RFID Hardware)  |---------->|    MQTT Broker    |
|  Publishes scan   | (TLS 8883)| (Port 8883, QoS 1)|
+-------------------+           +-------------------+
          ^                               |
          | Subscribes to result          | Subscribes to scan topic
          |                               v
+-------------------------------------------------------+
|              Node.js + Express Backend                |
|  - Validates RFID UID against MongoDB Student schema   |
|  - Enforces Atomic 10-Second Cooldown                 |
|  - Inserts Attendance record in MongoDB Atlas         |
|  - Logs every attempt in ScanEvent collection         |
|  - Publishes result back to HiveMQ Cloud MQTT broker  |
+-------------------------------------------------------+
          |                               |
          | Socket.IO Broadcast           | Mongoose Queries
          v                               v
+-------------------+           +-------------------+
|  React Dashboard  |           |   MongoDB Atlas   |
| (Vite + Tailwind) |           | (Students, Logs,  |
| Real-time Popups  |           |    Attendance)    |
+-------------------+           +-------------------+
```

---

## 💻 Technology Stack

### Frontend
- **React.js 18** (Vite build tool)
- **Tailwind CSS 3** (Light, modern design inspired by Linear & Vercel)
- **Lucide React** (Consistent icon library)
- **Socket.IO Client** (Instant bi-directional event stream)
- **Axios** (REST API communication)

### Backend
- **Node.js & Express.js** (REST API & WebSocket server)
- **MongoDB & Mongoose** (Database-backed models & atomic transactions)
- **MQTT.js** (TLS connection to HiveMQ Cloud broker)
- **Socket.IO** (Real-time client synchronization)
- **Helmet & Express Rate Limit** (Security & request flood mitigation)

### IoT & Firmware
- **ESP32 DevKit V1**
- **MFRC522 (RC522) RFID Reader**
- **HiveMQ Cloud MQTT Broker** (TLS 8883)
- **PubSubClient & ArduinoJson**

---

## 🔌 RC522 to ESP32 Wiring

Connect the RC522 reader to the ESP32 SPI pins as follows:

| RC522 Pin | ESP32 Pin | Function | Notes |
|---|---|---|---|
| **VCC** | **3V3 (3.3V)** | Power Supply | **CAUTION:** Do NOT connect to 5V / VIN! |
| **RST** | **GPIO 22** | Reset | Configurable in `attendance.ino` |
| **GND** | **GND** | Ground | Common ground |
| **IRQ** | *Not Connected* | Interrupt | Not needed |
| **MISO** | **GPIO 19** | SPI MISO | Master In, Slave Out |
| **MOSI** | **GPIO 23** | SPI MOSI | Master Out, Slave In |
| **SCK** | **GPIO 18** | SPI Clock | Serial Clock |
| **SDA (SS)** | **GPIO 5** | SPI Chip Select | Configurable in `attendance.ino` |

---

## 🗄️ Database Models

### 1. `Student`
- `name` (String, required)
- `studentId` (String, unique, e.g., `STU001`)
- `rfidUid` (String, unique, uppercase hex, e.g., `A1B2C3D4`)
- `lastAttendanceTimestamp` (Date, used for atomic cooldown test-and-set)
- `totalAttendance` (Number)
- `totalDuplicates` (Number)

### 2. `Attendance`
- `student` (ObjectId reference to `Student`)
- `studentName` (String)
- `studentId` (String)
- `rfidUid` (String)
- `deviceId` (String, default `ESP32_01`)
- `timestamp` (Date)
- `date` (String, `YYYY-MM-DD` for indexed daily querying)
- `status` (String, default `Present`)

### 3. `ScanEvent`
- `eventId` (String, unique)
- `uid` (String)
- `student` (ObjectId, optional)
- `studentName` (String)
- `deviceId` (String)
- `timestamp` (Date)
- `status` (`'success' | 'duplicate' | 'unknown'`)
- `remainingSeconds` (Number)
- `message` (String)

### 4. `Device`
- `deviceId` (String, unique)
- `deviceName` (String)
- `isOnline` (Boolean)
- `lastSeen` (Date)

---

## ⚡ 10-Second Cooldown Mechanism

To prevent duplicate attendance scans when a card is tapped multiple times:
1. The backend performs an atomic conditional update:
   ```javascript
   const updated = await Student.findOneAndUpdate(
     {
       _id: student._id,
       $or: [
         { lastAttendanceTimestamp: null },
         { lastAttendanceTimestamp: { $lte: cooldownThreshold } }
       ]
     },
     { $set: { lastAttendanceTimestamp: now }, $inc: { totalAttendance: 1 } },
     { new: true }
   );
   ```
2. If `updated` is `null`, the card is within its 10-second cooldown window:
   - Remaining seconds are calculated: `ceil((10000 - elapsed) / 1000)`.
   - A `duplicate` scan attempt is recorded in `ScanEvent`.
   - No duplicate record is added to `Attendance`.
   - Duplicate warning is emitted to Socket.IO and published to MQTT.
3. This atomic query eliminates race conditions, ensures each student operates independently, and persists cooldown state across server restarts.

---

## 🚀 Installation & Local Setup

### 1. Prerequisites
- Node.js (v18+ recommended)
- MongoDB (Local Community Server on `mongodb://127.0.0.1:27017` or MongoDB Atlas URI)

### 2. Backend Setup
```bash
# Navigate to backend directory
cd backend

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env

# Seed the default 3 sample students
npm run seed

# Start development backend
npm run dev
# Server will run on http://localhost:5001
```

### 3. Frontend Setup
```bash
# Navigate to frontend directory in another terminal
cd frontend

# Install dependencies
npm install

# Start Vite dev server
npm run dev
# Dashboard will run on http://localhost:5173
```

---

## ⚙️ Environment Variables

### `backend/.env`
```env
PORT=5001
MONGODB_URI=mongodb://127.0.0.1:27017/rfid_attendance
CLIENT_URL=http://localhost:5173
JWT_SECRET=your_jwt_secret
MQTT_BROKER_URL=mqtts://your-cluster-id.s1.eu.hivemq.cloud:8883
MQTT_USERNAME=your_hivemq_username
MQTT_PASSWORD=your_hivemq_password
MQTT_CLIENT_ID=rfid-attendance-server
MQTT_SCAN_TOPIC=attendance/+/scan
MQTT_RESULT_TOPIC_PATTERN=attendance/{deviceId}/result
ATTENDANCE_COOLDOWN_SECONDS=10
DEVICE_HEARTBEAT_TIMEOUT_SECONDS=60
ENABLE_TEST_ENDPOINT=true
```

### `frontend/.env`
```env
VITE_API_URL=http://localhost:5001
VITE_SOCKET_URL=http://localhost:5001
```

---

## 🧪 Simulation & Testing Guide

When physical ESP32 hardware is not yet connected:
1. Open the dashboard at `http://localhost:5173`.
2. Locate the **Test RFID Scanning** panel.
3. **Test 1 (Success)**: Click **Simulate Rahul's Card**.
   - Notice the green checkmark modal: *"ATTENDANCE MARKED SUCCESSFULLY!"*.
   - Rahul's attendance appears instantly in **Today's Attendance**.
   - Rahul's card displays a **10s cooldown timer**.
4. **Test 2 (Duplicate Cooldown)**: Click **Simulate Rahul's Card** again after 3 seconds.
   - Notice the yellow warning modal: *"DUPLICATE SCAN! Please wait before scanning again. Remaining: 7 seconds"*.
   - No duplicate record is added to the attendance table.
   - The rejected attempt is logged in **RFID Scan History**.
5. **Test 3 (Independent Card)**: Immediately click **Simulate Priya's Card**.
   - Priya's attendance is marked successfully, demonstrating independent cooldown timers.
6. **Test 4 (Unknown Card)**: Click **Simulate Unknown Card**.
   - Red alert modal appears: *"UNKNOWN RFID CARD! This card is not registered."*.
   - No attendance is recorded.
7. **Test 5 (Refresh Persistence)**: Refresh your browser.
   - All attendance entries, scan history, and active cooldown countdowns are retrieved directly from MongoDB.

---

## 📡 MQTT Topic Specification

| Topic | Publisher | Subscriber | QoS | Payload Example |
|---|---|---|---|---|
| `attendance/{deviceId}/scan` | ESP32 | Backend | 1 | `{"eventId":"scan-01","uid":"A1B2C3D4","deviceId":"ESP32_01"}` |
| `attendance/{deviceId}/result` | Backend | ESP32 | 1 | `{"eventId":"scan-01","uid":"A1B2C3D4","status":"success","studentName":"Rahul Sharma","message":"Attendance marked successfully"}` |
| `attendance/{deviceId}/status` | ESP32 | Backend | 1 | `{"deviceId":"ESP32_01","status":"online","ip":"192.168.1.45"}` |

---

## ☁️ Deployment Instructions

### Deploy Frontend to Vercel
1. Push repository to GitHub.
2. Link repository in Vercel.
3. Set **Root Directory** to `frontend`.
4. Configure Environment Variables:
   - `VITE_API_URL`: Your deployed Render backend URL (e.g., `https://rfid-backend.onrender.com`).
   - `VITE_SOCKET_URL`: Your deployed Render backend URL.
5. Deploy!

### Deploy Backend to Render
1. Create a **Web Service** on Render.
2. Set **Root Directory** to `backend`.
3. Build command: `npm install`
4. Start command: `node server.js`
5. Configure Environment Variables from `backend/.env.example`, including your **MongoDB Atlas connection string** and **HiveMQ Cloud credentials**.

---

## 🔧 Troubleshooting

- **MQTT connection issues**: Ensure you use `mqtts://` protocol and port `8883` for HiveMQ Cloud. HiveMQ Cloud requires TLS.
- **ESP32 Wi-Fi not connecting**: Ensure 2.4 GHz Wi-Fi band is used (ESP32 does not support 5 GHz Wi-Fi).
- **Socket.IO not connecting**: Ensure `VITE_SOCKET_URL` points to the correct backend host and port.
- **Port 5000 in use on Windows**: The backend defaults to port `5001` if port 5000 is occupied by Docker or WSL.
