/*
 * ============================================================================
 * RFID ATTENDANCE MONITOR - ESP32 + RC522 FIRMWARE
 * Smart IoT Attendance System with HiveMQ Cloud MQTT Integration
 * ============================================================================
 * 
 * Required Arduino Libraries:
 *  - WiFi (Built-in ESP32 core)
 *  - WiFiClientSecure (Built-in ESP32 core)
 *  - PubSubClient by Nick O'Leary (>= 2.8)
 *  - SPI (Built-in ESP32 core)
 *  - MFRC522 by GithubCommunity (>= 1.4.10)
 *  - ArduinoJson by Benoit Blanchon (>= 6.21.0 or 7.x)
 * 
 * Board Selection in Arduino IDE:
 *  - "DOIT ESP32 DEVKIT V1" or "ESP32 Dev Module"
 * ============================================================================
 */

#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <PubSubClient.h>
#include <SPI.h>
#include <MFRC522.h>
#include <ArduinoJson.h>

// ============================================================================
// 1. HARDWARE PIN CONFIGURATION (MFRC522 RC522 SPI PINS)
// ============================================================================
// Standard ESP32 VSPI Default Pins:
// SCK  -> GPIO 18
// MISO -> GPIO 19
// MOSI -> GPIO 23
// SS / SDA (Configurable below):
#define SS_PIN          5     // RC522 SDA / SS Pin
#define RST_PIN         22    // RC522 RST Pin

// Optional Status LED Pins (Built-in LED is usually GPIO 2)
#define LED_STATUS_PIN  2

// ============================================================================
// 2. NETWORK & HIVEMQ CLOUD MQTT CREDENTIALS
// ============================================================================
const char* WIFI_SSID     = "YOUR_WIFI_SSID";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";

// HiveMQ Cloud Broker Settings
// Example: "your-cluster-id.s1.eu.hivemq.cloud"
const char* MQTT_BROKER   = "your-cluster-id.s1.eu.hivemq.cloud";
const int   MQTT_PORT     = 8883; // Port 8883 for TLS/SSL
const char* MQTT_USER     = "hivemq_username";
const char* MQTT_PASSWORD = "hivemq_password";

// Unique Device Identifier
const char* DEVICE_ID     = "ESP32_01";

// MQTT Topics
// Scan publish: attendance/ESP32_01/scan
// Result subscribe: attendance/ESP32_01/result
// Heartbeat publish: attendance/ESP32_01/status
String TOPIC_SCAN;
String TOPIC_RESULT;
String TOPIC_STATUS;

// ============================================================================
// 3. OBJECT INSTANTIATIONS & GLOBAL TIMERS
// ============================================================================
WiFiClientSecure espClient;
PubSubClient mqttClient(espClient);
MFRC522 mfrc522(SS_PIN, RST_PIN);

unsigned long lastHeartbeat = 0;
const unsigned long HEARTBEAT_INTERVAL = 30000; // 30 seconds

// Hardware debouncing: avoid re-reading the exact same card continuously held on reader
String lastScannedUid = "";
unsigned long lastScannedTime = 0;
const unsigned long HARDWARE_DEBOUNCE_MS = 2500; // 2.5 seconds local debounce

// ============================================================================
// 4. MQTT CALLBACK (INCOMING RESULT FROM BACKEND)
// ============================================================================
void onMqttMessage(char* topic, byte* payload, unsigned int length) {
  char message[512];
  if (length >= sizeof(message)) length = sizeof(message) - 1;
  memcpy(message, payload, length);
  message[length] = '\0';

  Serial.println("\n------------------------------------------------");
  Serial.print("[MQTT RX] Topic: ");
  Serial.println(topic);
  Serial.print("[MQTT RX] Payload: ");
  Serial.println(message);

  // Parse result JSON from Backend
  StaticJsonDocument<512> doc;
  DeserializationError error = deserializeJson(doc, message);

  if (error) {
    Serial.print("[JSON] Deserialization error: ");
    Serial.println(error.f_str());
    return;
  }

  const char* status = doc["status"];
  const char* studentName = doc["studentName"] | "N/A";
  const char* studentId = doc["studentId"] | "";
  const char* msg = doc["message"] | "";
  int remainingSeconds = doc["remainingSeconds"] | 0;

  Serial.println("================================================");
  if (strcmp(status, "success") == 0) {
    Serial.println(">>>>> [RESULT: SUCCESS] ATTENDANCE CONFIRMED! <<<<<");
    Serial.print("Student: ");
    Serial.println(studentName);
    Serial.print("Student ID: ");
    Serial.println(studentId);
    Serial.print("Message: ");
    Serial.println(msg);

    // Quick LED blink confirmation (3 short pulses)
    for (int i = 0; i < 3; i++) {
      digitalWrite(LED_STATUS_PIN, HIGH);
      delay(80);
      digitalWrite(LED_STATUS_PIN, LOW);
      delay(80);
    }
  } 
  else if (strcmp(status, "duplicate") == 0) {
    Serial.println(">>>>> [RESULT: DUPLICATE] COOLDOWN ACTIVE <<<<<");
    Serial.print("Student: ");
    Serial.println(studentName);
    Serial.print("Remaining cooldown: ");
    Serial.print(remainingSeconds);
    Serial.println(" seconds.");
    Serial.print("Message: ");
    Serial.println(msg);

    // 1 Long blink for duplicate warning
    digitalWrite(LED_STATUS_PIN, HIGH);
    delay(400);
    digitalWrite(LED_STATUS_PIN, LOW);
  } 
  else if (strcmp(status, "unknown") == 0) {
    Serial.println(">>>>> [RESULT: UNKNOWN CARD] ACCESS DENIED <<<<<");
    Serial.println("Card is not registered in MongoDB database.");
    Serial.print("Message: ");
    Serial.println(msg);

    // Rapid warning flashes
    for (int i = 0; i < 5; i++) {
      digitalWrite(LED_STATUS_PIN, HIGH);
      delay(50);
      digitalWrite(LED_STATUS_PIN, LOW);
      delay(50);
    }
  }
  Serial.println("================================================\n");
}

// ============================================================================
// 5. WI-FI & MQTT CONNECTION MANAGERS
// ============================================================================
void setupWiFi() {
  delay(10);
  Serial.println();
  Serial.print("[WiFi] Connecting to SSID: ");
  Serial.println(WIFI_SSID);

  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 30) {
    delay(500);
    Serial.print(".");
    attempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n[WiFi] Connected successfully!");
    Serial.print("[WiFi] IP Address: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("\n[WiFi] Connection timed out. Will retry in loop...");
  }
}

void reconnectMqtt() {
  if (WiFi.status() != WL_CONNECTED) {
    setupWiFi();
    return;
  }

  while (!mqttClient.connected()) {
    Serial.print("[MQTT] Connecting to HiveMQ Cloud broker: ");
    Serial.print(MQTT_BROKER);
    Serial.print(":");
    Serial.println(MQTT_PORT);

    String clientId = "ESP32Client-" + String(DEVICE_ID) + "-" + String(random(0xffff), HEX);

    // Connect with HiveMQ TLS credentials
    if (mqttClient.connect(clientId.c_str(), MQTT_USER, MQTT_PASSWORD)) {
      Serial.println("[MQTT] Connected to broker!");

      // Subscribe to device-specific result topic
      mqttClient.subscribe(TOPIC_RESULT.c_str(), 1);
      Serial.print("[MQTT] Subscribed to: ");
      Serial.println(TOPIC_RESULT);

      // Publish initial heartbeat
      sendHeartbeat();
    } else {
      Serial.print("[MQTT] Failed, rc=");
      Serial.print(mqttClient.state());
      Serial.println(" Retrying in 5 seconds...");
      delay(5000);
    }
  }
}

void sendHeartbeat() {
  if (!mqttClient.connected()) return;

  StaticJsonDocument<128> doc;
  doc["deviceId"] = DEVICE_ID;
  doc["status"] = "online";
  doc["ip"] = WiFi.localIP().toString();

  char buffer[128];
  serializeJson(doc, buffer);

  mqttClient.publish(TOPIC_STATUS.c_str(), buffer, true);
  Serial.print("[Heartbeat] Sent to ");
  Serial.print(TOPIC_STATUS);
  Serial.print(": ");
  Serial.println(buffer);
}

// ============================================================================
// 6. SETUP & MAIN LOOP
// ============================================================================
void setup() {
  Serial.begin(115200);
  delay(1000);

  Serial.println("\n************************************************");
  Serial.println("  RFID ATTENDANCE MONITOR - ESP32 FIRMWARE     ");
  Serial.println("  Smart IoT Attendance System | ESP32 + RC522   ");
  Serial.println("************************************************");

  pinMode(LED_STATUS_PIN, OUTPUT);
  digitalWrite(LED_STATUS_PIN, LOW);

  // Initialize Topics
  TOPIC_SCAN   = "attendance/" + String(DEVICE_ID) + "/scan";
  TOPIC_RESULT = "attendance/" + String(DEVICE_ID) + "/result";
  TOPIC_STATUS = "attendance/" + String(DEVICE_ID) + "/status";

  // Initialize SPI & MFRC522 Reader
  SPI.begin();
  mfrc522.PCD_Init();
  delay(50);
  mfrc522.PCD_DumpVersionToSerial();
  Serial.println("[RC522] RFID Reader initialized successfully.");

  // Configure Secure TLS client (HiveMQ Cloud uses TLS)
  // For production with HiveMQ Cloud CA, root certificate can be loaded,
  // or setInsecure() allows TLS handshake without storing 4KB root CA cert.
  espClient.setInsecure();

  mqttClient.setServer(MQTT_BROKER, MQTT_PORT);
  mqttClient.setCallback(onMqttMessage);
  mqttClient.setBufferSize(512);

  setupWiFi();
}

void loop() {
  // Ensure Wi-Fi & MQTT connections
  if (WiFi.status() != WL_CONNECTED) {
    setupWiFi();
  }
  if (!mqttClient.connected()) {
    reconnectMqtt();
  }
  mqttClient.loop();

  // Periodic Heartbeat
  unsigned long currentMillis = millis();
  if (currentMillis - lastHeartbeat >= HEARTBEAT_INTERVAL) {
    lastHeartbeat = currentMillis;
    sendHeartbeat();
  }

  // Look for new RFID card
  if (!mfrc522.PICC_IsNewCardPresent()) {
    return;
  }

  // Select one of the cards
  if (!mfrc522.PICC_ReadCardSerial()) {
    return;
  }

  // Convert UID bytes into Uppercase Hexadecimal String (e.g., "A1B2C3D4")
  String scannedUid = "";
  for (byte i = 0; i < mfrc522.uid.size; i++) {
    if (mfrc522.uid.uidByte[i] < 0x10) {
      scannedUid += "0";
    }
    scannedUid += String(mfrc522.uid.uidByte[i], HEX);
  }
  scannedUid.toUpperCase();

  // Hardware debouncing: prevent re-transmitting exact same physical touch
  if (scannedUid == lastScannedUid && (currentMillis - lastScannedTime < HARDWARE_DEBOUNCE_MS)) {
    // Card is still resting on the coil; ignore immediate duplicate hardware read
    mfrc522.PICC_HaltA();
    mfrc522.PCD_StopCrypto1();
    return;
  }

  lastScannedUid = scannedUid;
  lastScannedTime = currentMillis;

  Serial.println("\n------------------------------------------------");
  Serial.print("[RC522] Card Detected! UID: ");
  Serial.println(scannedUid);

  // Generate unique eventId for deduplication
  String eventId = "scan-" + String(DEVICE_ID) + "-" + String(millis()) + "-" + String(random(1000, 9999));

  // Build JSON Payload
  StaticJsonDocument<256> doc;
  doc["eventId"] = eventId;
  doc["uid"] = scannedUid;
  doc["deviceId"] = DEVICE_ID;

  char payloadBuffer[256];
  serializeJson(doc, payloadBuffer);

  // Publish to MQTT Broker (QoS 1)
  if (mqttClient.publish(TOPIC_SCAN.c_str(), payloadBuffer, false)) {
    Serial.print("[MQTT TX] Published scan event to ");
    Serial.print(TOPIC_SCAN);
    Serial.print(": ");
    Serial.println(payloadBuffer);
  } else {
    Serial.println("[MQTT TX] Publish failed!");
  }

  // Halt PICC
  mfrc522.PICC_HaltA();
  mfrc522.PCD_StopCrypto1();
}
