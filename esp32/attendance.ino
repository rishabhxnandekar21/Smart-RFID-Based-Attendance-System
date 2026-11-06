/*
 * ============================================================================
 * RFID ATTENDANCE MONITOR - ESP32 + RC522 FIRMWARE (PURE MQTT VIA HIVEMQ)
 * Matches your exact physical breadboard schematic wiring
 * ============================================================================
 */

#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <PubSubClient.h>
#include <SPI.h>
#include <MFRC522.h>
#include <ArduinoJson.h>

// ============================================================================
// 1. HARDWARE PIN CONFIGURATION (FROM YOUR PHYSICAL SCHEMATIC)
// ============================================================================
#define RC522_SS_PIN    5   // D5
#define RC522_RST_PIN   15  // D15
#define RC522_SCK_PIN   17  // D17
#define RC522_MOSI_PIN  16  // D16
#define RC522_MISO_PIN  4   // D4

#define GREEN_LED_PIN   12  // D12
#define RED_LED_PIN     14  // D14
#define BUZZER_PIN      23  // D23

// ============================================================================
// 2. NETWORK & HIVEMQ CLOUD MQTT CREDENTIALS
// ============================================================================
const char* WIFI_SSID     = "Rish";
const char* WIFI_PASSWORD = "123456780";

// HiveMQ Cloud Broker Settings (Replace with your HiveMQ cluster details)
const char* MQTT_BROKER   = "your-cluster-id.s1.eu.hivemq.cloud";
const int   MQTT_PORT     = 8883; // Port 8883 for TLS/SSL
const char* MQTT_USER     = "your_hivemq_username";
const char* MQTT_PASSWORD = "your_hivemq_password";

// Device Identifier
const char* DEVICE_ID     = "ESP32_01";

// MQTT Topics
String TOPIC_SCAN;
String TOPIC_RESULT;
String TOPIC_STATUS;

// ============================================================================
// 3. OBJECTS & TIMERS
// ============================================================================
WiFiClientSecure espClient;
PubSubClient mqttClient(espClient);
MFRC522 mfrc522(RC522_SS_PIN, RC522_RST_PIN);

unsigned long lastHeartbeat = 0;
const unsigned long HEARTBEAT_INTERVAL = 30000; // 30s heartbeat

String lastScannedUid = "";
unsigned long lastScannedTime = 0;
const unsigned long HARDWARE_DEBOUNCE_MS = 2500;

void soundBuzzer(int durationMs, int count = 1) {
  for (int i = 0; i < count; i++) {
    digitalWrite(BUZZER_PIN, HIGH);
    delay(durationMs);
    digitalWrite(BUZZER_PIN, LOW);
    if (count > 1) delay(60);
  }
}

// ============================================================================
// 4. MQTT CALLBACK: INCOMING ATTENDANCE RESULT FROM BACKEND
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

  StaticJsonDocument<512> doc;
  DeserializationError error = deserializeJson(doc, message);
  if (error) {
    Serial.print("[JSON Error]: ");
    Serial.println(error.f_str());
    return;
  }

  const char* status = doc["status"];
  const char* studentName = doc["studentName"] | "N/A";
  const char* studentId = doc["studentId"] | "";
  int remainingSeconds = doc["remainingSeconds"] | 0;

  Serial.println("================================================");
  if (strcmp(status, "success") == 0) {
    Serial.println(">>>>> [MQTT: SUCCESS] ATTENDANCE CONFIRMED! <<<<<");
    Serial.print("Student: ");
    Serial.print(studentName);
    Serial.print(" (");
    Serial.print(studentId);
    Serial.println(")");

    // Visual & Sound Feedback
    digitalWrite(GREEN_LED_PIN, HIGH);
    digitalWrite(RED_LED_PIN, LOW);
    soundBuzzer(70, 2); // 2 short beeps
    delay(2000);
    digitalWrite(GREEN_LED_PIN, LOW);
  } 
  else if (strcmp(status, "duplicate") == 0) {
    Serial.println(">>>>> [MQTT: DUPLICATE] 10s COOLDOWN ACTIVE <<<<<");
    Serial.print("Please wait ");
    Serial.print(remainingSeconds);
    Serial.println("s before tapping again.");

    digitalWrite(RED_LED_PIN, HIGH);
    soundBuzzer(300, 1); // 1 warning beep
    delay(1500);
    digitalWrite(RED_LED_PIN, LOW);
  } 
  else if (strcmp(status, "unknown") == 0) {
    Serial.println(">>>>> [MQTT: UNKNOWN CARD] ACCESS DENIED <<<<<");
    digitalWrite(RED_LED_PIN, HIGH);
    soundBuzzer(50, 4); // 4 rapid warning beeps
    delay(2000);
    digitalWrite(RED_LED_PIN, LOW);
  }
  Serial.println("================================================\n");
}

// ============================================================================
// 5. WI-FI & MQTT BROKER RECONNECTION
// ============================================================================
void setupWiFi() {
  delay(10);
  Serial.print("\n[WiFi] Connecting to SSID: ");
  Serial.println(WIFI_SSID);

  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 30) {
    delay(500);
    Serial.print(".");
    digitalWrite(RED_LED_PIN, !digitalRead(RED_LED_PIN));
    attempts++;
  }
  digitalWrite(RED_LED_PIN, LOW);

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n[WiFi] Connected successfully!");
    Serial.print("[WiFi] IP: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("\n[WiFi] Failed to connect.");
  }
}

void reconnectMqtt() {
  if (WiFi.status() != WL_CONNECTED) {
    setupWiFi();
    return;
  }

  while (!mqttClient.connected()) {
    Serial.print("[MQTT] Connecting to HiveMQ Cloud: ");
    Serial.println(MQTT_BROKER);

    String clientId = "ESP32Client-" + String(DEVICE_ID) + "-" + String(random(0xffff), HEX);

    if (mqttClient.connect(clientId.c_str(), MQTT_USER, MQTT_PASSWORD)) {
      Serial.println("[MQTT] Connected to HiveMQ Cloud broker!");
      mqttClient.subscribe(TOPIC_RESULT.c_str(), 1);
      Serial.print("[MQTT] Subscribed to result topic: ");
      Serial.println(TOPIC_RESULT);

      sendHeartbeat();
    } else {
      Serial.print("[MQTT] Connect failed, rc=");
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
  Serial.println("[Heartbeat] Sent online status via MQTT");
}

// ============================================================================
// 6. SETUP & LOOP
// ============================================================================
void setup() {
  Serial.begin(115200);
  delay(1000);

  pinMode(GREEN_LED_PIN, OUTPUT);
  pinMode(RED_LED_PIN, OUTPUT);
  pinMode(BUZZER_PIN, OUTPUT);
  digitalWrite(GREEN_LED_PIN, LOW);
  digitalWrite(RED_LED_PIN, LOW);
  digitalWrite(BUZZER_PIN, LOW);

  Serial.println("\n************************************************");
  Serial.println("  RFID ATTENDANCE MONITOR - PURE MQTT (HIVEMQ) ");
  Serial.println("************************************************");

  TOPIC_SCAN   = "attendance/" + String(DEVICE_ID) + "/scan";
  TOPIC_RESULT = "attendance/" + String(DEVICE_ID) + "/result";
  TOPIC_STATUS = "attendance/" + String(DEVICE_ID) + "/status";

  // Initialize SPI with your exact schematic pins: SCK=17, MISO=4, MOSI=16, SS=5
  SPI.begin(RC522_SCK_PIN, RC522_MISO_PIN, RC522_MOSI_PIN, RC522_SS_PIN);
  mfrc522.PCD_Init();
  delay(50);
  mfrc522.PCD_DumpVersionToSerial();
  Serial.println("[RC522] Initialized on SCK=17, MOSI=16, MISO=4, SS=5, RST=15");

  // Power on beep
  soundBuzzer(80);

  // Configure Secure TLS for HiveMQ Cloud (Port 8883)
  espClient.setInsecure();
  mqttClient.setServer(MQTT_BROKER, MQTT_PORT);
  mqttClient.setCallback(onMqttMessage);
  mqttClient.setBufferSize(512);

  setupWiFi();
}

void loop() {
  if (WiFi.status() != WL_CONNECTED) setupWiFi();
  if (!mqttClient.connected()) reconnectMqtt();
  mqttClient.loop();

  // 30s Heartbeat
  unsigned long now = millis();
  if (now - lastHeartbeat >= HEARTBEAT_INTERVAL) {
    lastHeartbeat = now;
    sendHeartbeat();
  }

  // Check for card
  if (!mfrc522.PICC_IsNewCardPresent()) return;
  if (!mfrc522.PICC_ReadCardSerial()) return;

  String scannedUid = "";
  for (byte i = 0; i < mfrc522.uid.size; i++) {
    if (mfrc522.uid.uidByte[i] < 0x10) scannedUid += "0";
    scannedUid += String(mfrc522.uid.uidByte[i], HEX);
  }
  scannedUid.toUpperCase();

  if (scannedUid == lastScannedUid && (now - lastScannedTime < HARDWARE_DEBOUNCE_MS)) {
    mfrc522.PICC_HaltA();
    mfrc522.PCD_StopCrypto1();
    return;
  }
  lastScannedUid = scannedUid;
  lastScannedTime = now;

  Serial.println("\n------------------------------------------------");
  Serial.print("[RC522 TAP] Card Scanned! UID: ");
  Serial.println(scannedUid);

  // Publish to MQTT Topic: attendance/ESP32_01/scan
  String eventId = "scan-" + String(DEVICE_ID) + "-" + String(millis()) + "-" + String(random(1000, 9999));
  StaticJsonDocument<256> doc;
  doc["eventId"] = eventId;
  doc["uid"] = scannedUid;
  doc["deviceId"] = DEVICE_ID;

  char payloadBuffer[256];
  serializeJson(doc, payloadBuffer);

  if (mqttClient.publish(TOPIC_SCAN.c_str(), payloadBuffer, 1)) {
    Serial.print("[MQTT TX] Published scan to: ");
    Serial.println(TOPIC_SCAN);
    Serial.print("[MQTT TX] Payload: ");
    Serial.println(payloadBuffer);
  } else {
    Serial.println("[MQTT TX] Failed to publish message!");
  }

  mfrc522.PICC_HaltA();
  mfrc522.PCD_StopCrypto1();
}
