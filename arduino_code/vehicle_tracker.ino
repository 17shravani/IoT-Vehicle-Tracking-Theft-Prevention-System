/**
 * @file vehicle_tracker.ino
 * @brief IoT Vehicle Tracking & Theft Prevention System Firmware
 * @author IoT Embedded Systems Engineer
 * 
 * Target Board: ESP32 (NodeMCU or similar)
 * Peripherals:
 * - NEO-6M GPS Module (UART2: RX=16, TX=17)
 * - Relay Module (GPIO 25) - Simulates Ignition Control (Active Low / High)
 * - Piezo Buzzer (GPIO 26) - Audible Security Alarms
 * - Status LED (GPIO 2) - Onboard ESP32 Blue LED for connection status
 */

#include <WiFi.h>
#include <PubSubClient.h>
#include <TinyGPS++.h>

// ==========================================
// CONFIGURATION PARAMETERS (Adjust as needed)
// ==========================================
const char* WIFI_SSID       = "Wokwi-GUEST";       // Change to your Wi-Fi SSID
const char* WIFI_PASSWORD   = "";                  // Change to your Wi-Fi Password
const char* MQTT_BROKER     = "broker.hivemq.com"; // Public MQTT Broker
const int   MQTT_PORT       = 1883;
const char* CLIENT_ID       = "ESP32_Vehicle_Tracker_001";

// MQTT Topics
const char* TOPIC_TELEMETRY = "iot/vehicle/telemetry";
const char* TOPIC_CONTROL   = "iot/vehicle/control";
const char* TOPIC_STATUS    = "iot/vehicle/status";

// Pin Allocations
#define PIN_GPS_RX     16  // Connect to NEO-6M TX
#define PIN_GPS_TX     17  // Connect to NEO-6M RX
#define PIN_RELAY      25  // Connect to Relay signal input
#define PIN_BUZZER     26  // Connect to active buzzer module
#define PIN_STATUS_LED  2  // Onboard blue LED

// ==========================================
// OBJECT DEFINITIONS
// ==========================================
HardwareSerial gpsSerial(2); // Use UART2
TinyGPSPlus gps;
WiFiClient espClient;
PubSubClient mqttClient(espClient);

// Global Variables
bool engineLocked = false;
unsigned long lastTelemetryTime = 0;
const unsigned long TELEMETRY_INTERVAL = 3000; // Publish telemetry every 3 seconds

// ==========================================
// HELPER FUNCTIONS
// ==========================================

/**
 * @brief Initial setup of the Wi-Fi connection
 */
void setupWiFi() {
  Serial.print("\nConnecting to Wi-Fi SSID: ");
  Serial.println(WIFI_SSID);

  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  int attempt = 0;
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
    // Toggle status LED rapidly during connection phase
    digitalWrite(PIN_STATUS_LED, !digitalRead(PIN_STATUS_LED));
    attempt++;
    if (attempt > 40) {
      Serial.println("\nWi-Fi connection failed! Retrying...");
      attempt = 0;
    }
  }

  digitalWrite(PIN_STATUS_LED, HIGH); // Solid ON when connected
  Serial.println("\nWi-Fi connected successfully!");
  Serial.print("IP Address: ");
  Serial.println(WiFi.localIP());
}

/**
 * @brief Handles incoming messages from MQTT Broker
 */
void mqttCallback(char* topic, byte* payload, unsigned int length) {
  String message = "";
  for (unsigned int i = 0; i < length; i++) {
    message += (char)payload[i];
  }
  
  Serial.print("\n[MQTT Command Received] Topic: ");
  Serial.print(topic);
  Serial.print(" | Message: ");
  Serial.println(message);

  if (String(topic) == TOPIC_CONTROL) {
    if (message == "LOCK") {
      engineLocked = true;
      digitalWrite(PIN_RELAY, LOW); // Trigger relay (lock ignition, assuming active-low or NC/NO wiring)
      digitalWrite(PIN_BUZZER, HIGH); // Sound warning buzzer
      delay(200);
      digitalWrite(PIN_BUZZER, LOW);
      
      mqttClient.publish(TOPIC_STATUS, "{\"engine_status\":\"LOCKED\",\"alert\":\"Engine locked remotely\"}");
      Serial.println("STATUS: Engine LOCKED. Ignition Relay disabled.");
    } 
    else if (message == "UNLOCK") {
      engineLocked = false;
      digitalWrite(PIN_RELAY, HIGH); // Release relay (allow engine startup)
      
      // Multi-tone beep for unlock confirmation
      for (int i = 0; i < 3; i++) {
        digitalWrite(PIN_BUZZER, HIGH);
        delay(80);
        digitalWrite(PIN_BUZZER, LOW);
        delay(80);
      }
      
      mqttClient.publish(TOPIC_STATUS, "{\"engine_status\":\"UNLOCKED\",\"alert\":\"Engine unlocked remotely\"}");
      Serial.println("STATUS: Engine UNLOCKED. Ignition Relay enabled.");
    }
  }
}

/**
 * @brief Establishes/re-establishes connection to MQTT broker
 */
void reconnectMQTT() {
  while (!mqttClient.connected()) {
    Serial.print("Attempting MQTT connection to ");
    Serial.print(MQTT_BROKER);
    Serial.print("...");
    
    // Attempt connection
    if (mqttClient.connect(CLIENT_ID)) {
      Serial.println(" connected!");
      // Subscribing to engine control topic
      mqttClient.subscribe(TOPIC_CONTROL);
      // Publish initial registration message
      mqttClient.publish(TOPIC_STATUS, "{\"device\":\"ESP32_Vehicle_Tracker\",\"status\":\"ONLINE\"}");
    } else {
      Serial.print(" failed, rc=");
      Serial.print(mqttClient.state());
      Serial.println(" | Retrying in 5 seconds...");
      
      // Visual indicator of MQTT error (slow blink)
      digitalWrite(PIN_STATUS_LED, LOW);
      delay(2500);
      digitalWrite(PIN_STATUS_LED, HIGH);
      delay(2500);
    }
  }
}

/**
 * @brief Read GPS and publish telemetry to MQTT
 */
void publishTelemetry(float latitude, float longitude, float speedKmph, float headingDeg, int satellites) {
  char jsonBuffer[256];
  
  // Format telemetry as a clean JSON payload
  snprintf(jsonBuffer, sizeof(jsonBuffer),
    "{"
    "\"latitude\":%.6f,"
    "\"longitude\":%.6f,"
    "\"speed\":%.2f,"
    "\"heading\":%.1f,"
    "\"satellites\":%d,"
    "\"engine_locked\":%s"
    "}",
    latitude,
    longitude,
    speedKmph,
    headingDeg,
    satellites,
    engineLocked ? "true" : "false"
  );
  
  Serial.print("Publishing Telemetry: ");
  Serial.println(jsonBuffer);
  
  mqttClient.publish(TOPIC_TELEMETRY, jsonBuffer);
}

// ==========================================
// MAIN SETUP AND LOOP
// ==========================================

void setup() {
  // Initialize Serial Monitors
  Serial.begin(115200);
  gpsSerial.begin(9600, SERIAL_8N1, PIN_GPS_RX, PIN_GPS_TX);
  
  // Configure pins
  pinMode(PIN_RELAY, OUTPUT);
  pinMode(PIN_BUZZER, OUTPUT);
  pinMode(PIN_STATUS_LED, OUTPUT);
  
  // Initialize default states
  digitalWrite(PIN_RELAY, HIGH); // Ignition Active / Allowed initially
  digitalWrite(PIN_BUZZER, LOW);  // Buzzer Off
  digitalWrite(PIN_STATUS_LED, LOW);
  
  Serial.println("\n--- IoT Vehicle Tracking System Booting Up ---");
  
  setupWiFi();
  
  mqttClient.setServer(MQTT_BROKER, MQTT_PORT);
  mqttClient.setCallback(mqttCallback);
}

void loop() {
  // Ensure network and broker connections are active
  if (WiFi.status() != WL_CONNECTED) {
    setupWiFi();
  }
  if (!mqttClient.connected()) {
    reconnectMQTT();
  }
  
  mqttClient.loop();

  // Parse NMEA data stream from NEO-6M module
  while (gpsSerial.available() > 0) {
    gps.encode(gpsSerial.read());
  }

  // Periodic telemetry publisher (if GPS fix is active)
  unsigned long currentMillis = millis();
  if (currentMillis - lastTelemetryTime >= TELEMETRY_INTERVAL) {
    lastTelemetryTime = currentMillis;

    if (gps.location.isValid() && gps.location.isUpdated()) {
      float currentLat  = gps.location.lat();
      float currentLon  = gps.location.lng();
      float currentSpd  = gps.speed.kmph();
      float currentHead = gps.course.deg();
      int satCount      = gps.satellites.value();
      
      publishTelemetry(currentLat, currentLon, currentSpd, currentHead, satCount);
    } 
    else {
      // If no valid GPS fix is established, publish dummy coordinates or status flag
      Serial.println("[GPS WARNING] Searching for Satellite signals (No valid FIX yet)...");
      
      // Standard indicator for "no satellite fix" during hardware deployment
      mqttClient.publish(TOPIC_STATUS, "{\"status\":\"WARNING\",\"message\":\"No GPS fix\"}");
    }
  }
}
