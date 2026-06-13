# Circuit Diagram & Hardware Schematics

This document outlines the wiring connections, pin layouts, and safety practices required to build and deploy the **IoT Vehicle Tracking & Theft Prevention System** using the ESP32 microcontroller.

---

## 1. Connection Pin Mapping Table

| Component | Pin Label | ESP32 GPIO | Description |
| :--- | :--- | :--- | :--- |
| **NEO-6M GPS** | VCC | 3.3V / 5V | Power supply input (Recommended: 3.3V or 5V check module rating) |
| **NEO-6M GPS** | GND | GND | Common ground connection |
| **NEO-6M GPS** | TX | GPIO 16 (RX2) | Hardware serial data receive on ESP32 |
| **NEO-6M GPS** | RX | GPIO 17 (TX2) | Hardware serial data transmit on ESP32 |
| **Relay Module**| VCC | 5V | Powers the electromagnetic coil |
| **Relay Module**| GND | GND | Common ground connection |
| **Relay Module**| IN | GPIO 25 | Signal line to toggle ignition status (Active Low) |
| **Buzzer** | VCC / + | GPIO 26 | Digital output to trigger warning siren |
| **Buzzer** | GND / - | GND | Common ground connection |
| **Onboard LED** | D2 | GPIO 2 (Internal)| Connects to onboard status indicator LED |

---

## 2. System Schematic (ASCII representation)

```
       +-------------------------------------------------------------+
       |                                                             |
       |                   ESP32 Microcontroller                     |
       |                                                             |
       +-----3.3V----5V----GND----GPIO16----GPIO17----GPIO25----GPIO26+
              |      |      |       ^         |         |         |
              |      |      |       |         |         |         |
      +-------+      |      |       |         |         |         |
      | VCC          |      |       |         |         |         |
      v              |      |       |         |         |         |
  +-------+          |      |       |         |         |         |
  | NEO-  |          |      |       |         |         |         |
  |  6M   |          |      |       |         |         |         |
  |  GPS  |          |      v       |         |         |         v
  +-------+          |     GND      |         |         |     +-------+
    TX --------------+--------------+         |         |     |Active |
    RX <-------------+------------------------+         |     |Buzzer |
                                                        |     +-------+
                                                        v         |
                                                    +-------+     v
                                                    | Relay |    GND
                                                    |Module |
                                                    +-------+
                                                     /     \
                                                    /       \
                                                ( COM )   ( NC )
                                                   |         |
                                                   v         v
                                                Vehicle   Ignition
                                                12V Main  Line Out
```

---

## 3. High-Voltage Relay Ignition Cutoff Diagram

To disable the engine, the relay acts as an automated switch in series with the vehicle's ignition coils or fuel pump power supply:

```
[Vehicle 12V Battery Key Switch] ---> (Relay COM Pin)
                                       (Relay NC Pin) ---> [Ignition Coils / Fuel Pump]
```
- **Normally Closed (NC)** configuration is highly recommended: If the tracking device loses power or fails, the relay remains closed, preventing the vehicle from stalling dangerously while driving on the highway.
- **Relay COM (Common)** is connected to the primary ignition supply line.
- **Normally Open (NO)** is left disconnected (isolated).

---

## 4. Power Integration & Industrial Safety Guidelines

When installing this circuit inside a real vehicle, observe the following safety standards:

1. **Opto-Isolation**: Use a relay module equipped with an optocoupler (e.g., PC817). This isolates the high-current automotive circuit from the low-voltage ESP32 logic pins, preventing EMI (electromagnetic interference) back-EMF from resetting the microcontroller.
2. **Step-Down Buck Converter**: A car battery supplies 12V to 14.4V (when charging). Use an automotive-grade DC-to-DC buck converter (like the **LM2596** or a high-efficiency switching regulator) to scale this voltage down to a stable **5.0V** for the ESP32. Do not feed 12V directly to the ESP32.
3. **Inline Fuse Protection**: Always place a **1A inline fuse** on the 12V tap line before the buck converter. This protects the vehicle's electrical harness from fires in the event of a short circuit in the tracker.
4. **GPS Antenna Orientation**: The ceramic patch antenna of the NEO-6M must face skyward, free from metallic obstructions. Plastic dashboards are fine, but mounting underneath structural steel frames will block GPS satellite signals.
