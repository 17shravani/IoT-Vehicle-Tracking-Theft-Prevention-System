import os
import csv
import json
import time
import math
import argparse
import random
from datetime import datetime
import paho.mqtt.client as mqtt

# ==========================================
# CONSTANTS & CONFIGURATION
# ==========================================
MQTT_BROKER = "broker.hivemq.com"
MQTT_PORT = 1883
TOPIC_TELEMETRY = "iot/vehicle/telemetry"
TOPIC_CONTROL = "iot/vehicle/control"
TOPIC_STATUS = "iot/vehicle/status"

# Geofence Center (e.g., Bangalore Central) & Safe Radius (in meters)
BASE_LAT = 12.9716
BASE_LON = 77.5946
GEOFENCE_RADIUS_METERS = 300.0  # 300 meters safe zone

# Files
LOG_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data")
LOG_FILE = os.path.join(LOG_DIR, "vehicle_logs.csv")

class VehicleSimulator:
    def __init__(self, mode="normal"):
        self.mode = mode.lower()
        self.latitude = BASE_LAT
        self.longitude = BASE_LON
        self.speed = 0.0          # km/h
        self.heading = 0.0        # degrees
        self.engine_locked = False
        self.alert_type = "NONE"   # NONE, THEFT_ALERT, GEOFENCE_BREACH
        self.running = True
        self.tick_count = 0
        
        # Ensure log directory exists
        os.makedirs(LOG_DIR, exist_ok=True)
        self.init_csv_log()
        
        # MQTT Setup
        self.client = mqtt.Client(client_id="Python_Vehicle_Simulator")
        self.client.on_connect = self.on_connect
        self.client.on_message = self.on_message

    def init_csv_log(self):
        """Initializes the CSV log file with headers if it doesn't exist."""
        if not os.path.exists(LOG_FILE):
            with open(LOG_FILE, mode="w", newline="") as file:
                writer = csv.writer(file)
                writer.writerow(["Timestamp", "Latitude", "Longitude", "Speed", "Heading", "Engine_Status", "Alert_Type"])
            print(f"[SIMULATOR] Logging initialized at: {LOG_FILE}")

    def log_to_csv(self):
        """Appends the current state of the vehicle to the CSV file."""
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        engine_status = "LOCKED" if self.engine_locked else "UNLOCKED"
        try:
            with open(LOG_FILE, mode="a", newline="") as file:
                writer = csv.writer(file)
                writer.writerow([
                    timestamp,
                    f"{self.latitude:.6f}",
                    f"{self.longitude:.6f}",
                    f"{self.speed:.2f}",
                    f"{self.heading:.1f}",
                    engine_status,
                    self.alert_type
                ])
        except Exception as e:
            print(f"[SIMULATOR ERROR] Failed to write to CSV: {e}")

    # ==========================================
    # MQTT EVENT HANDLERS
    # ==========================================
    def on_connect(self, client, userdata, flags, rc):
        if rc == 0:
            print(f"[MQTT] Connected successfully to broker: {MQTT_BROKER}")
            self.client.subscribe(TOPIC_CONTROL)
            self.client.publish(TOPIC_STATUS, json.dumps({
                "device": "Simulated_Vehicle",
                "status": "ONLINE",
                "mode": self.mode
            }))
        else:
            print(f"[MQTT] Connection failed with code {rc}")

    def on_message(self, client, userdata, msg):
        payload = msg.payload.decode("utf-8").strip()
        print(f"[MQTT Command] Received: {payload} on topic {msg.topic}")
        
        if msg.topic == TOPIC_CONTROL:
            if payload == "LOCK":
                self.engine_locked = True
                print("[SIMULATOR] System Locked! Remote engine relay activated.")
                self.client.publish(TOPIC_STATUS, json.dumps({
                    "engine_status": "LOCKED",
                    "alert": "Engine Locked Remotely"
                }))
            elif payload == "UNLOCK":
                self.engine_locked = False
                self.alert_type = "NONE"
                print("[SIMULATOR] System Unlocked! Remote engine relay deactivated.")
                self.client.publish(TOPIC_STATUS, json.dumps({
                    "engine_status": "UNLOCKED",
                    "alert": "Engine Unlocked Remotely"
                }))

    # ==========================================
    # GEOGRAPHIC CALCULATIONS
    # ==========================================
    def calculate_distance_meters(self, lat1, lon1, lat2, lon2):
        """Calculates the distance in meters between two coordinates using the Haversine formula."""
        R = 6371000.0  # Earth's radius in meters
        phi1 = math.radians(lat1)
        phi2 = math.radians(lat2)
        delta_phi = math.radians(lat2 - lat1)
        delta_lambda = math.radians(lon2 - lon1)
        
        a = (math.sin(delta_phi / 2) ** 2 +
             math.cos(phi1) * math.cos(phi2) *
             (math.sin(delta_lambda / 2) ** 2))
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
        return R * c

    def update_gps_coordinates(self):
        """Simulates vehicle movement according to the selected mode."""
        self.tick_count += 1
        
        if self.mode == "parked":
            # Vehicle remains stationary with minor GPS drift (realistic)
            self.speed = 0.0
            self.heading = 0.0
            self.latitude = BASE_LAT + random.uniform(-0.00002, 0.00002)
            self.longitude = BASE_LON + random.uniform(-0.00002, 0.00002)
            
        elif self.mode == "normal":
            # Vehicle drives a scenic looping path around the base station
            self.speed = 45.0 + random.uniform(-5.0, 5.0)
            self.heading = (self.tick_count * 12) % 360
            rad = math.radians(self.heading)
            
            # 1 meter lat ~ 0.000009 deg; 1 meter lon ~ 0.000009 / cos(lat) deg
            # Moving roughly 25 meters per step
            self.latitude += (self.speed * 0.277778 * math.cos(rad) * 2) * 0.000009
            self.longitude += (self.speed * 0.277778 * math.sin(rad) * 2) * 0.000009 / math.cos(math.radians(self.latitude))
            
        elif self.mode == "geofence_exit":
            # Drives straight out of the safe boundary zone
            self.speed = 60.0
            self.heading = 45.0  # Heading North-East
            rad = math.radians(self.heading)
            
            # Fast movement away from center
            self.latitude += (self.speed * 0.277778 * math.cos(rad) * 2) * 0.000009
            self.longitude += (self.speed * 0.277778 * math.sin(rad) * 2) * 0.000009 / math.cos(math.radians(self.latitude))
            
        elif self.mode == "stolen":
            # Vehicle is locked, but starts moving (unauthorized towing or ignition bypass)
            self.engine_locked = True
            self.speed = 30.0 + (self.tick_count * 2) # Accelerating
            self.heading = 270.0 # Moving West
            rad = math.radians(self.heading)
            
            self.latitude += (self.speed * 0.277778 * math.cos(rad) * 2) * 0.000009
            self.longitude += (self.speed * 0.277778 * math.sin(rad) * 2) * 0.000009 / math.cos(math.radians(self.latitude))

    def check_alarms(self):
        """Runs the security detection engine."""
        # Calculate distance to base
        dist_from_base = self.calculate_distance_meters(BASE_LAT, BASE_LON, self.latitude, self.longitude)
        
        # 1. Geofence violation
        if dist_from_base > GEOFENCE_RADIUS_METERS:
            self.alert_type = "GEOFENCE_BREACH"
        # 2. Theft Alert (unauthorized movement when engine is locked)
        elif self.engine_locked and self.speed > 5.0:
            self.alert_type = "THEFT_ALERT"
        else:
            self.alert_type = "NONE"

    def publish_telemetry(self):
        """Formats and publishes telemetry to the MQTT broker."""
        payload = {
            "latitude": round(self.latitude, 6),
            "longitude": round(self.longitude, 6),
            "speed": round(self.speed, 2),
            "heading": round(self.heading, 1),
            "engine_locked": self.engine_locked,
            "alert_type": self.alert_type,
            "distance_from_base": round(self.calculate_distance_meters(BASE_LAT, BASE_LON, self.latitude, self.longitude), 1),
            "timestamp": datetime.now().isoformat()
        }
        
        # Publish to telemetry topic
        self.client.publish(TOPIC_TELEMETRY, json.dumps(payload))
        
        # If alert exists, publish high-priority alert status
        if self.alert_type != "NONE":
            alert_payload = {
                "alert": self.alert_type,
                "message": f"CRITICAL: {self.alert_type} detected! Position: {self.latitude:.6f},{self.longitude:.6f}",
                "timestamp": datetime.now().isoformat()
            }
            self.client.publish(TOPIC_STATUS, json.dumps(alert_payload))
            print(f"\n[ALERT GENERATED] {alert_payload['message']}")
            
        print(f"[{datetime.now().strftime('%H:%M:%S')}] Published Telemetry: Mode={self.mode} | Lat={self.latitude:.6f} | Lng={self.longitude:.6f} | Alert={self.alert_type}")

    def run(self):
        """Starts the simulator main loop."""
        try:
            self.client.connect(MQTT_BROKER, MQTT_PORT, 60)
            self.client.loop_start()
            
            print(f"\n==============================================")
            print(f"🚀 IoT Vehicle Simulation Engine Active!")
            print(f"Mode: {self.mode.upper()}")
            print(f"Safe Base Center: {BASE_LAT}, {BASE_LON}")
            print(f"Safe Radius Limit: {GEOFENCE_RADIUS_METERS} meters")
            print(f"Publishing updates every 2 seconds to MQTT...")
            print(f"==============================================\n")
            
            while self.running:
                self.update_gps_coordinates()
                self.check_alarms()
                self.log_to_csv()
                self.publish_telemetry()
                time.sleep(2)
                
        except KeyboardInterrupt:
            print("\n[SIMULATOR] Shutting down simulation gracefully...")
        finally:
            self.client.loop_stop()
            self.client.disconnect()
            print("[SIMULATOR] Simulation terminated.")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="IoT GPS Vehicle Telemetry Simulator")
    parser.add_argument(
        "--mode", 
        type=str, 
        default="normal",
        choices=["normal", "parked", "stolen", "geofence_exit"],
        help="Simulation run mode (normal, parked, stolen, geofence_exit)"
    )
    args = parser.parse_args()
    
    sim = VehicleSimulator(mode=args.mode)
    sim.run()
