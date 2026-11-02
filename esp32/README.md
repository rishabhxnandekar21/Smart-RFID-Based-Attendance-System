# ESP32 + RC522 RFID Firmware Setup Guide

This folder contains the complete Arduino firmware (`attendance.ino`) for the **RFID Attendance Monitor** IoT system.

---

## 1. Hardware Requirements

| Component | Description | Recommended Specification |
|---|---|---|
| **Microcontroller** | ESP32 Development Board | ESP32-WROOM-32 / DOIT DevKit V1 (30 or 38 pins) |
| **RFID Reader** | MFRC522 RFID Module | 13.56 MHz SPI Reader with RFID Cards / Fobs |
| **Power Supply** | Micro-USB Cable / 5V DC | 5V 1A+ via USB port |
| **Jumper Wires** | Female-to-Female | 7–8 wires for SPI connection |
| **Optional LED** | 3mm/5mm LED + 220Ω Resistor | Or use built-in GPIO 2 LED |

---

## 2. Wiring & Pinout (RC522 to ESP32)

Connect the MFRC522 module to the ESP32 SPI pins as shown in the table below:

| RC522 Pin | ESP32 GPIO Pin | Function | Notes |
|---|---|---|---|
| **VCC (3.3V)** | **3V3** | Power Supply | **CAUTION:** RC522 is a 3.3V module. Do NOT connect to 5V (VIN)! |
| **RST** | **GPIO 22** | Reset | Configurable in code (`RST_PIN`) |
| **GND** | **GND** | Ground | Common Ground |
| **IRQ** | *Unconnected* | Interrupt Request | Not used in polling mode |
| **MISO** | **GPIO 19** | SPI Master In / Slave Out | Hardware VSPI MISO |
| **MOSI** | **GPIO 23** | SPI Master Out / Slave In | Hardware VSPI MOSI |
| **SCK** | **GPIO 18** | SPI Serial Clock | Hardware VSPI Clock |
| **SDA / SS** | **GPIO 5** | SPI Slave Select (SS) | Configurable in code (`SS_PIN`) |

---

## 3. Arduino IDE Setup & Required Libraries

1. Download and install [Arduino IDE (2.x or 1.8.x)](https://www.arduino.cc/en/software).
2. Install the **ESP32 Board Package**:
   - Go to **File** > **Preferences** > **Additional Boards Manager URLs**.
   - Add: `https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json`
   - Open **Tools** > **Board** > **Boards Manager**, search for `esp32` by Espressif Systems, and click **Install**.
3. Install the required libraries via **Sketch** > **Include Library** > **Manage Libraries...**:
   - **PubSubClient** by *Nick O'Leary* (v2.8+)
   - **MFRC522** by *GithubCommunity* (v1.4.10+)
   - **ArduinoJson** by *Benoit Blanchon* (v6.21.x or v7.x)

---

## 4. HiveMQ Cloud Configuration

1. Sign up for a free cloud cluster at [HiveMQ Cloud](https://www.hivemq.com/cloud/).
2. Create a Serverless Cluster (free forever, up to 100 devices).
3. Under **Cluster Overview**, note your **Cluster URL** (e.g., `xxxxxxxx.s1.eu.hivemq.cloud`).
4. Go to **Access Management** and create credentials:
   - **Username**: `esp32_gate` (or your choice)
   - **Password**: `YourStrongPassword123`
   - Permissions: Publish & Subscribe on `attendance/#`
5. Port: **8883** (MQTT over TLS).

---

## 5. Configuring `attendance.ino`

Open `attendance.ino` and replace the following credentials:

```cpp
const char* WIFI_SSID     = "YOUR_WIFI_NAME";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";

const char* MQTT_BROKER   = "your-cluster-id.s1.eu.hivemq.cloud";
const int   MQTT_PORT     = 8883;
const char* MQTT_USER     = "hivemq_username";
const char* MQTT_PASSWORD = "hivemq_password";

const char* DEVICE_ID     = "ESP32_01";
```

---

## 6. Uploading and Testing

1. Connect the ESP32 to your computer via USB.
2. Select your board under **Tools** > **Board** > **esp32** > **DOIT ESP32 DEVKIT V1**.
3. Select your serial port under **Tools** > **Port** (e.g., `COM3` on Windows).
4. Click **Upload**.
5. Once uploaded, open **Tools** > **Serial Monitor** and set baud rate to **115200**.

### Expected Serial Monitor Output:
```text
************************************************
  RFID ATTENDANCE MONITOR - ESP32 FIRMWARE     
  Smart IoT Attendance System | ESP32 + RC522   
************************************************
[RC522] RFID Reader initialized successfully.
[WiFi] Connecting to SSID: MyHomeWiFi...
[WiFi] Connected successfully!
[WiFi] IP Address: 192.168.1.45
[MQTT] Connecting to HiveMQ Cloud broker: xxxxx.s1.eu.hivemq.cloud:8883
[MQTT] Connected to broker!
[MQTT] Subscribed to: attendance/ESP32_01/result
[Heartbeat] Sent to attendance/ESP32_01/status: {"deviceId":"ESP32_01","status":"online","ip":"192.168.1.45"}
```

When you tap an RFID card:
```text
[RC522] Card Detected! UID: A1B2C3D4
[MQTT TX] Published scan event to attendance/ESP32_01/scan: {"eventId":"scan-ESP32_01-1240-8472","uid":"A1B2C3D4","deviceId":"ESP32_01"}

[MQTT RX] Topic: attendance/ESP32_01/result
[MQTT RX] Payload: {"eventId":"scan-ESP32_01-1240-8472","uid":"A1B2C3D4","status":"success","studentName":"Rahul Sharma","studentId":"STU001","message":"Attendance marked successfully"}
================================================
>>>>> [RESULT: SUCCESS] ATTENDANCE CONFIRMED! <<<<<
Student: Rahul Sharma
Student ID: STU001
Message: Attendance marked successfully
================================================
```

---

## 7. Troubleshooting

- **Reader not detected (`Firmware Version: 0x0 or 0xFF`)**: Check 3.3V connection, Ground, and ensure SPI pins (SCK=18, MISO=19, MOSI=23, SS=5) are securely jumpered.
- **TLS Handshake error (`rc=-2`)**: Verify HiveMQ broker URL and credentials. Ensure system time on computer is correct.
- **Card not reading**: Ensure card is 13.56MHz Mifare (RC522 does NOT read 125kHz EM4100 cards).
