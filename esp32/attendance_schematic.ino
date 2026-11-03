/*
 * ============================================================================
 * ESP32 SMART RFID ATTENDANCE SYSTEM - CUSTOM SCHEMATIC PINOUT
 * Matches your exact physical breadboard wiring diagram
 * ============================================================================
 * 
 * EXACT PIN ASSIGNMENTS FROM YOUR SCHEMATIC:
 * 
 * [RC522 RFID Reader (SPI)]:
 *  - SDA (SS) -> GPIO 5   (D5)
 *  - SCK      -> GPIO 17  (D17)
 *  - MOSI     -> GPIO 16  (D16)
 *  - MISO     -> GPIO 4   (D4)
 *  - RST      -> GPIO 15  (D15)
 *  - 3V3      -> 3V3 rail
 *  - GND      -> GND rail
 * 
 * [0.96" I2C OLED Display (128x64)]:
 *  - SDA      -> GPIO 21  (D21)
 *  - SCL      -> GPIO 22  (D22)
 *  - VCC      -> 3V3 rail
 *  - GND      -> GND rail
 * 
 * [Peripherals & Indicators]:
 *  - Green LED -> GPIO 12  (D12) + 220Ω -> GND rail
 *  - Red LED   -> GPIO 14  (D14) + 220Ω -> GND rail
 *  - Buzzer    -> GPIO 23  (D23) -> GND rail
 * ============================================================================
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include <Wire.h>
#include <SPI.h>
#include <MFRC522.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>

// 1. Wi-Fi Configuration
const char* ssid     = "Rish";
const char* password = "123456780";

// 2. Laptop Dashboard Backend URL
const char* serverUrl = "http://10.255.207.212:5001/api/attendance/scan";

// 3. Pin Definitions (From Your Schematic)
#define RC522_SS_PIN    5
#define RC522_RST_PIN   15
#define RC522_SCK_PIN   17
#define RC522_MOSI_PIN  16
#define RC522_MISO_PIN  4

#define OLED_SDA_PIN    21
#define OLED_SCL_PIN    22

#define GREEN_LED_PIN   12
#define RED_LED_PIN     14
#define BUZZER_PIN      23

// 4. OLED Display Setup (128x64 I2C)
#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64
#define OLED_RESET    -1
#define SCREEN_ADDRESS 0x3C
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET);

// 5. RC522 Reader Setup
MFRC522 mfrc522(RC522_SS_PIN, RC522_RST_PIN);

// Debounce timing
String lastUid = "";
unsigned long lastScanTime = 0;
const unsigned long DEBOUNCE_DELAY = 2500; // 2.5 seconds local debounce

// Buzzer & LED Helper Functions
void soundBuzzer(int durationMs, int count = 1) {
  for (int i = 0; i < count; i++) {
    digitalWrite(BUZZER_PIN, HIGH);
    delay(durationMs);
    digitalWrite(BUZZER_PIN, LOW);
    if (count > 1) delay(60);
  }
}

void showOledStandby() {
  display.clearDisplay();
  display.setTextSize(1);
  display.setTextColor(SSD1306_WHITE);
  display.setCursor(16, 4);
  display.println("RFID ATTENDANCE");
  display.drawLine(0, 15, 127, 15, SSD1306_WHITE);

  display.setCursor(10, 26);
  display.setTextSize(1);
  display.println("Ready to Scan...");
  display.setCursor(14, 44);
  display.println("[ Tap ID Card ]");
  display.display();
}

void showOledMessage(const char* title, const char* line1, const char* line2) {
  display.clearDisplay();
  display.setTextSize(1);
  display.setTextColor(SSD1306_WHITE);
  display.setCursor(10, 2);
  display.println(title);
  display.drawLine(0, 14, 127, 14, SSD1306_WHITE);

  display.setCursor(0, 24);
  display.setTextSize(1);
  display.println(line1);

  display.setCursor(0, 42);
  display.setTextSize(1);
  display.println(line2);
  display.display();
}

void setup() {
  Serial.begin(115200);
  delay(1000);

  // Initialize Pin Modes
  pinMode(GREEN_LED_PIN, OUTPUT);
  pinMode(RED_LED_PIN, OUTPUT);
  pinMode(BUZZER_PIN, OUTPUT);
  digitalWrite(GREEN_LED_PIN, LOW);
  digitalWrite(RED_LED_PIN, LOW);
  digitalWrite(BUZZER_PIN, LOW);

  Serial.println("\n================================================");
  Serial.println("  ESP32 RFID ATTENDANCE - SCHEMATIC PROFILE     ");
  Serial.println("================================================");

  // 1. Initialize I2C for OLED with auto-detection for 0x3C and 0x3D
  Wire.begin(OLED_SDA_PIN, OLED_SCL_PIN);
  bool oledFound = display.begin(SSD1306_SWITCHCAPVCC, 0x3C);
  if (!oledFound) {
    oledFound = display.begin(SSD1306_SWITCHCAPVCC, 0x3D);
  }

  if (!oledFound) {
    Serial.println("[OLED] Warning: SSD1306 not found at 0x3C or 0x3D. Check VCC/SDA/SCL wiring.");
  } else {
    Serial.println("[OLED] Display initialized successfully!");
    display.clearDisplay();
    display.setTextSize(1);
    display.setTextColor(SSD1306_WHITE);
    display.setCursor(15, 25);
    display.println("System Ready!");
    display.display();
  }

  // 2. Initialize SPI with your exact pins: SCK=17, MISO=4, MOSI=16, SS=5
  SPI.begin(RC522_SCK_PIN, RC522_MISO_PIN, RC522_MOSI_PIN, RC522_SS_PIN);
  mfrc522.PCD_Init();
  delay(50);
  mfrc522.PCD_DumpVersionToSerial();
  Serial.println("[RC522] Initialized with SCK=17, MOSI=16, MISO=4, SS=5, RST=15");

  // Power-on quick self-test beep
  soundBuzzer(80);
  digitalWrite(GREEN_LED_PIN, HIGH);
  delay(150);
  digitalWrite(GREEN_LED_PIN, LOW);

  // 3. Connect to Wi-Fi
  Serial.print("[WiFi] Connecting to SSID: ");
  Serial.println(ssid);
  showOledMessage("WIFI CONNECTING", ssid, "Please wait...");

  WiFi.mode(WIFI_STA);
  WiFi.begin(ssid, password);

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
    soundBuzzer(50, 2);
  } else {
    Serial.println("\n[WiFi] Failed to connect! Working in offline mode.");
  }

  showOledStandby();
}

void loop() {
  // Look for card
  if (!mfrc522.PICC_IsNewCardPresent()) return;
  if (!mfrc522.PICC_ReadCardSerial()) return;

  // Read UID
  String scannedUid = "";
  for (byte i = 0; i < mfrc522.uid.size; i++) {
    if (mfrc522.uid.uidByte[i] < 0x10) scannedUid += "0";
    scannedUid += String(mfrc522.uid.uidByte[i], HEX);
  }
  scannedUid.toUpperCase();

  unsigned long currentMillis = millis();
  if (scannedUid == lastUid && (currentMillis - lastScanTime < DEBOUNCE_DELAY)) {
    mfrc522.PICC_HaltA();
    mfrc522.PCD_StopCrypto1();
    return;
  }
  lastUid = scannedUid;
  lastScanTime = currentMillis;

  Serial.println("\n------------------------------------------------");
  Serial.print("[CARD DETECTED] UID: ");
  Serial.println(scannedUid);

  // Send to Backend
  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    http.begin(serverUrl);
    http.addHeader("Content-Type", "application/json");

    String json = "{\"uid\":\"" + scannedUid + "\",\"deviceId\":\"ESP32_01\"}";
    int httpCode = http.POST(json);
    String response = http.getString();

    Serial.print("[HTTP Code]: ");
    Serial.println(httpCode);
    Serial.print("[Backend Response]: ");
    Serial.println(response);

    if (httpCode == 200) {
      // SUCCESS: Attendance Confirmed
      Serial.println(">>>>> [SUCCESS] ATTENDANCE RECORDED! <<<<<");
      digitalWrite(GREEN_LED_PIN, HIGH);
      digitalWrite(RED_LED_PIN, LOW);
      soundBuzzer(70, 2); // 2 short cheerful beeps

      showOledMessage("ATTENDANCE MARKED", "Status: PRESENT", scannedUid.c_str());
      delay(2500);
      digitalWrite(GREEN_LED_PIN, LOW);
    } 
    else if (httpCode == 429) {
      // DUPLICATE: 10s Cooldown Active
      Serial.println(">>>>> [DUPLICATE] COOLDOWN ACTIVE <<<<<");
      digitalWrite(RED_LED_PIN, HIGH);
      soundBuzzer(300, 1); // 1 medium warning beep

      showOledMessage("DUPLICATE SCAN", "Wait 10s cooldown", scannedUid.c_str());
      delay(2000);
      digitalWrite(RED_LED_PIN, LOW);
    } 
    else if (httpCode == 404) {
      // UNKNOWN: Unregistered Card
      Serial.println(">>>>> [UNKNOWN CARD] ACCESS DENIED <<<<<");
      digitalWrite(RED_LED_PIN, HIGH);
      soundBuzzer(50, 4); // Rapid error beeps

      showOledMessage("ACCESS DENIED", "Unregistered Card", scannedUid.c_str());
      delay(2500);
      digitalWrite(RED_LED_PIN, LOW);
    } 
    else {
      // Server error / unreachable
      Serial.println(">>>>> [ERROR] Server error <<<<<");
      showOledMessage("SERVER ERROR", "Check connection", "");
      delay(2000);
    }
    http.end();
  } else {
    Serial.println("[ERROR] Wi-Fi not connected");
    showOledMessage("WIFI ERROR", "Reconnecting...", "");
  }

  showOledStandby();
  mfrc522.PICC_HaltA();
  mfrc522.PCD_StopCrypto1();
}
