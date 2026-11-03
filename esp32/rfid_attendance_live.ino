/*
 * ============================================================================
 * ESP32 + RC522 RFID LIVE ATTENDANCE MONITOR
 * Connects to Wi-Fi "Rish" & Posts Scans Directly to Local Backend Dashboard
 * ============================================================================
 * 
 * Hardware Wiring:
 *  RC522 3.3V (VCC) -> ESP32 3V3  (DO NOT CONNECT TO 5V/VIN!)
 *  RC522 RST        -> ESP32 GPIO 22
 *  RC522 GND        -> ESP32 GND
 *  RC522 MISO       -> ESP32 GPIO 19
 *  RC522 MOSI       -> ESP32 GPIO 23
 *  RC522 SCK        -> ESP32 GPIO 18
 *  RC522 SDA (SS)   -> ESP32 GPIO 5
 * ============================================================================
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include <SPI.h>
#include <MFRC522.h>

// 1. Wi-Fi Configuration
const char* ssid     = "Rish";
const char* password = "123456780";

// 2. Backend Server Endpoint (Your Laptop's IP on the Wi-Fi network)
const char* serverUrl = "http://10.255.207.212:5001/api/attendance/scan";

// 3. RC522 Pin Definitions
#define SS_PIN   5
#define RST_PIN  22
#define LED_PIN  2  // Built-in status LED

MFRC522 mfrc522(SS_PIN, RST_PIN);

// Debouncing to avoid repeated triggers if card stays on reader
String lastUid = "";
unsigned long lastScanMillis = 0;
const unsigned long DEBOUNCE_TIME = 2000; // 2 seconds local debounce

void setup() {
  Serial.begin(115200);
  delay(1000);

  pinMode(LED_PIN, OUTPUT);
  digitalWrite(LED_PIN, LOW);

  Serial.println("\n==========================================");
  Serial.println("  ESP32 + RC522 LIVE ATTENDANCE SCANNER   ");
  Serial.println("==========================================");

  // Initialize SPI & RC522
  SPI.begin();
  mfrc522.PCD_Init();
  delay(50);
  mfrc522.PCD_DumpVersionToSerial();
  Serial.println("[RC522] RFID Reader initialized.");

  // Connect to Wi-Fi
  Serial.print("[WiFi] Connecting to: ");
  Serial.println(ssid);
  WiFi.mode(WIFI_STA);
  WiFi.begin(ssid, password);

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
    digitalWrite(LED_PIN, !digitalRead(LED_PIN));
  }

  digitalWrite(LED_PIN, HIGH);
  Serial.println("\n[WiFi] Connected successfully!");
  Serial.print("[WiFi] IP Address: ");
  Serial.println(WiFi.localIP());
  Serial.println("[System] Ready! Tap an RFID card to mark attendance.\n");
}

void loop() {
  // Check if a new RFID card is presented
  if (!mfrc522.PICC_IsNewCardPresent()) {
    return;
  }

  // Read card serial UID
  if (!mfrc522.PICC_ReadCardSerial()) {
    return;
  }

  // Convert UID to Uppercase Hexadecimal String (e.g. A1B2C3D4)
  String scannedUid = "";
  for (byte i = 0; i < mfrc522.uid.size; i++) {
    if (mfrc522.uid.uidByte[i] < 0x10) {
      scannedUid += "0";
    }
    scannedUid += String(mfrc522.uid.uidByte[i], HEX);
  }
  scannedUid.toUpperCase();

  // Local Debounce check
  unsigned long now = millis();
  if (scannedUid == lastUid && (now - lastScanMillis < DEBOUNCE_TIME)) {
    mfrc522.PICC_HaltA();
    mfrc522.PCD_StopCrypto1();
    return;
  }
  lastUid = scannedUid;
  lastScanMillis = now;

  Serial.println("------------------------------------------");
  Serial.print("[RFID TAP DETECTED] UID: ");
  Serial.println(scannedUid);

  // Send Scan to Node.js Backend Dashboard
  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    http.begin(serverUrl);
    http.addHeader("Content-Type", "application/json");

    String jsonPayload = "{\"uid\":\"" + scannedUid + "\",\"deviceId\":\"ESP32_01\"}";
    Serial.print("[HTTP] Sending to Dashboard: ");
    Serial.println(jsonPayload);

    int httpResponseCode = http.POST(jsonPayload);
    String responseString = http.getString();

    Serial.print("[HTTP Response Code]: ");
    Serial.println(httpResponseCode);
    Serial.print("[Backend Response]: ");
    Serial.println(responseString);

    if (httpResponseCode == 200) {
      Serial.println(">>>>> [SUCCESS] ATTENDANCE MARKED ON DASHBOARD! <<<<<");
      // Blink LED 3 times for success
      for (int i = 0; i < 3; i++) {
        digitalWrite(LED_PIN, LOW);
        delay(100);
        digitalWrite(LED_PIN, HIGH);
        delay(100);
      }
    } else if (httpResponseCode == 429) {
      Serial.println(">>>>> [DUPLICATE] 10s COOLDOWN ACTIVE - PLEASE WAIT <<<<<");
      digitalWrite(LED_PIN, LOW);
      delay(500);
      digitalWrite(LED_PIN, HIGH);
    } else if (httpResponseCode == 404) {
      Serial.println(">>>>> [UNKNOWN CARD] ACCESS DENIED - UNREGISTERED <<<<<");
      for (int i = 0; i < 6; i++) {
        digitalWrite(LED_PIN, !digitalRead(LED_PIN));
        delay(80);
      }
      digitalWrite(LED_PIN, HIGH);
    } else {
      Serial.println(">>>>> [ERROR] Check Backend connection <<<<<");
    }

    http.end();
  } else {
    Serial.println("[ERROR] Wi-Fi disconnected. Cannot send data.");
  }
  Serial.println("------------------------------------------\n");

  mfrc522.PICC_HaltA();
  mfrc522.PCD_StopCrypto1();
}
