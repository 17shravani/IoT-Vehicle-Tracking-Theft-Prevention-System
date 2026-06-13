# IoT Vehicle Tracking & Theft Prevention System (Aegis-Track)

[![Build Status](https://img.shields.io/badge/Build-Passing-brightgreen.svg)]()
[![Platform Compatibility](https://img.shields.io/badge/Platform-ESP32%20%7C%20Windows%20%7C%20macOS%20%7C%20Linux-blue.svg)]()
[![MQTT Broker](https://img.shields.io/badge/Protocol-MQTT%20over%20WebSockets-purple.svg)]()
[![Hardware Status](https://img.shields.io/badge/Hardware-NEO--6M%20GPS%20%2C%20Active%20Buzzer%20%2C%20Relay-orange.svg)]()
[![Python Version](https://img.shields.io/badge/Python-3.8%2B-blue.svg)]()
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

Aegis-Track is a dual-mode (Physical Hardware + Virtual Simulation) intelligent IoT security system designed to prevent vehicle theft, establish geofencing perimeters, log coordinate histories, and facilitate remote ignition immobilization commands.

---

## 1. Project Concept & Technical Architecture

### Simple Explanation
Think of this project as a smart watchdog for vehicles. A GPS unit tracks the vehicle's location and reports it to a central cloud server. A web-based map displays where the vehicle is moving. If the vehicle moves outside a pre-set safe zone, or if someone moves it after it has been locked, the system automatically triggers a warning siren and alerts the owner. The owner can also press a button on their web dashboard to remotely lock the engine, preventing the thief from driving away.

### Technical Explanation
The project relies on a low-latency, event-driven architecture using **MQTT (Message Queuing Telemetry Transport)**. Telemetry is parsed from raw GPS NMEA sentences on the edge (ESP32 or Python Simulation) and published as JSON strings. A custom web control center connects to the broker via **MQTT-over-WebSockets** using the Paho library, rendering location updates in real time on a Leaflet-based map, and executing remote engine immobilization commands over a subscription topic.

### System Flow
```
[NEO-6M GPS Module] ---> (NMEA Sentences) ---> [ESP32 Firmware]
                                                    | (Wi-Fi / MQTT Pub)
                                                    v
[Python Simulator] ----------------------------> [HiveMQ Public MQTT Broker]
                                                    | (WebSockets Pub/Sub)
                                                    v
                                         [Leaflet.js Web Dashboard]
                                                    | (Lock/Unlock Commands)
                                                    v
[Ignition Relay COM/NC] <--- (Low/High Signal) <- [ESP32 / Simulator Node]
```

---

## 2. Key Features

- **Real-Time GPS Tracking**: High-accuracy coordinate rendering on a premium CartoDB Dark Matter tile layer.
- **Remote Ignition Immobilization**: Interactive command control switches on the dashboard to remotely lock/unlock the engine relay.
- **Dynamic Circular Geofencing**: Computes real-time offsets using the **Haversine Formula** and alerts the user if the vehicle breaches a 300-meter threshold.
- **Anti-Theft Intrusion Logic**: Raises high-priority warnings if GPS movement is registered while the engine lock is engaged.
- **Dual-Mode Operation**: Fully executable using real ESP32 hardware or a Python-based path-projection simulator (no hardware required for testing).
- **Automated Reporting Engine**: Parses CSV logs and renders clean PDF summaries and CSV reports containing trip speed stats and alarm events.

---

## 3. Tech Stack

| Layer | Component | Technology Used |
| :--- | :--- | :--- |
| **Embedded Edge** | Microcontroller | ESP32 (NodeMCU / DevKit v1) |
| **Edge Programming** | Language & Tools | C++ (Arduino IDE), TinyGPS++, PubSubClient |
| **Virtual Edge** | Simulator | Python 3 (paho-mqtt) |
| **Communication** | IoT protocol | MQTT over WebSockets (Port 8000) & TCP (Port 1883) |
| **User Interface** | Web Dashboard | HTML5, Vanilla CSS3 (Glassmorphism), JavaScript (ES6) |
| **Map Rendering** | GIS API | Leaflet.js (OpenStreetMap / CartoDB Dark Matter tiles) |
| **Data & Reports** | Logging & Rendering | CSV Files, ReportLab PDF Compilation Library |

---

## 4. Hardware Wiring Layout

Refer to [docs/circuit_diagram.md](file:///docs/circuit_diagram.md) for full schematics.

- **NEO-6M GPS**: TX &rarr; ESP32 GPIO 16 (RX2), RX &rarr; ESP32 GPIO 17 (TX2), VCC &rarr; 3.3V/5V, GND &rarr; GND.
- **Relay Module (5V Single-Channel)**: IN &rarr; ESP32 GPIO 25, VCC &rarr; 5V, GND &rarr; GND. COM connected to Ignition source; NC connected to Coil load.
- **Active Buzzer**: Pin (+) &rarr; ESP32 GPIO 26, Pin (-) &rarr; GND.

---

## 5. Setup & Execution Guide (Virtual Simulation Mode)

### Step 1: Install Dependencies
Open a command prompt/terminal in the project root directory and run:
```bash
pip install -r requirements.txt
```

### Step 2: Launch the Web Dashboard
Start the local dashboard HTTP server:
```bash
python main.py --dashboard
```
This command spins up a web server at `http://localhost:8085` and opens the Aegis-Track command center directly in your default browser.

### Step 3: Run the GPS Tracker Simulator
In a separate terminal, launch the simulator to feed telemetry to the dashboard:
```bash
python main.py --sim normal
```
Other available simulation modes:
- `python main.py --sim parked` (Mock stationary coordinates with random GPS drift noise)
- `python main.py --sim stolen` (Mock vehicle moving away while the ignition engine is locked)
- `python main.py --sim geofence_exit` (Mock vehicle driving straight out of the 300m boundary zone)

*Alternatively, click the **"Run Live Demo Mode"** button directly on the web dashboard to simulate vehicle movements offline without opening any secondary terminal.*

### Step 4: Compile Performance Reports
To compile session logs into a PDF report, run:
```bash
python main.py --report
```
The resulting PDF summary report will be saved to `reports/telemetry_report.pdf`.

---

## 6. Project Directory Structure

```
IOT-Vehicle Tracking & Theft Prevention System/
├── arduino_code/
│   └── vehicle_tracker.ino      # C++ code for real ESP32 deployment
├── python_simulation/
│   ├── sim_tracker.py           # Simulated GPS node engine
│   └── report_generator.py      # PDF/CSV compiler utility
├── dashboard/
│   ├── index.html               # Web interface structure
│   ├── style.css                # Glassmorphism dark layout rules
│   └── app.js                   # WebSocket map handler
├── docs/
│   ├── circuit_diagram.md       # Board connections and safety guidelines
│   └── interview_prep.md        # Placement questions and answers guide
├── data/                        # CSV telemetry data storage
├── reports/                     # Output directory for generated PDF reports
├── requirements.txt             # Python requirements file
├── main.py                      # Global entry point launcher script
└── README.md                    # This document
```

---

## 7. Resume & GitHub Showcase Guide

### Resume Impact Bullet Points (STAR Format)
- **Developed** a real-time IoT vehicle tracking and remote immobilization system using ESP32, NEO-6M GPS, and MQTT, decreasing command latency to sub-100ms.
- **Designed** a responsive web dashboard utilizing Leaflet.js and MQTT-over-WebSockets to render coordinate coordinates and speedometer gauges dynamically.
- **Implemented** a geofencing monitoring system utilizing the Haversine formula to trigger visual and auditory warning notifications on security breaches.
- **Built** a robust Python-based GPS simulation test-harness, enabling hardware-less system validation across normal driving, parked, and theft scenarios.
- **Authored** a data reporting pipeline using Python and ReportLab to parse raw CSV telemetry files and output styled, client-ready PDF summaries automatically.

### Recommended GitHub Metadata
- **Repository Name**: `iot-vehicle-tracking-theft-prevention-system`
- **Description**: `An IoT vehicle tracking, geofencing, and remote immobilization system built using ESP32, NEO-6M GPS, MQTT, and Leaflet.js, featuring a simulated Python engine and PDF reporter.`
- **Topics**: `iot`, `esp32`, `mqtt`, `gps-tracking`, `geofencing`, `embedded-systems`, `leafletjs`, `python-simulation`
