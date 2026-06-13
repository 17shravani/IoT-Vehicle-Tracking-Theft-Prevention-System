// ==========================================================================
// Aegis-Track Advanced Application Control Logic
// ==========================================================================

// Global App State
let map;
let vehicleMarker;
let geofenceCircle;
let pathPolyline = [];
let routeCoordinates = [];
let mqttClient = null;
let isDemoMode = false;
let demoInterval = null;
let currentEngineLocked = false;
let audioMuted = false;

// Geofence configuration (Mutable dynamically)
let baseLat = 12.9716;
let baseLon = 77.5946;
let geofenceRadius = 300; // meters

// Charts state
let speedChart = null;
const MAX_CHART_POINTS = 15;
let speedHistory = Array(MAX_CHART_POINTS).fill(0);
let chartLabels = Array(MAX_CHART_POINTS).fill("");
let totalSpeedsRecorded = 0;
let sumSpeedsRecorded = 0;

// MQTT Details
const MQTT_BROKER_HOST = "broker.hivemq.com";
const MQTT_BROKER_PORT = 8000;
const MQTT_PATH = "/mqtt";
const MQTT_CLIENT_ID = "Aegis_Web_Client_" + Math.random().toString(36).substring(5);

const TOPIC_TELEMETRY = "iot/vehicle/telemetry";
const TOPIC_STATUS = "iot/vehicle/status";
const TOPIC_CONTROL = "iot/vehicle/control";

// UI References
const btnLock = document.getElementById('btn-lock');
const btnUnlock = document.getElementById('btn-unlock');
const textIgnition = document.getElementById('ignition-state-text');
const valSpeed = document.getElementById('tel-speed');
const valSats = document.getElementById('tel-sats');
const valGeofence = document.getElementById('tel-geofence');
const valDistance = document.getElementById('tel-distance');
const listAlerts = document.getElementById('alerts-log');
const consoleOutput = document.getElementById('console-output');
const displayLatLng = document.getElementById('lat-lng-display');
const linkGmaps = document.getElementById('gmaps-link');
const indicatorMqtt = document.getElementById('mqtt-status-indicator');
const textMqttStatus = document.getElementById('mqtt-status-text');
const btnDemo = document.getElementById('btn-demo');
const btnClearLogs = document.getElementById('btn-clear-logs');

// Advanced UI References
const btnAudioToggle = document.getElementById('btn-audio-toggle');
const sliderGeofence = document.getElementById('slider-geofence');
const valGeofenceRadius = document.getElementById('geofence-radius-val');
const valGeoCenterLat = document.getElementById('geo-center-lat');
const valGeoCenterLon = document.getElementById('geo-center-lon');
const btnResetGeofence = document.getElementById('btn-reset-geofence');
const btnExportAlerts = document.getElementById('btn-export-alerts');
const lblAvgSpeed = document.getElementById('lbl-avg-speed');
const themeOptions = document.querySelectorAll('.theme-option');

// Alerts buffer for CSV export
let incidentList = [];

// ==========================================================================
// INITIALIZE MAP
// ==========================================================================
function initMap() {
    map = L.map('map', {
        zoomControl: true,
        maxZoom: 19,
        minZoom: 10
    }).setView([baseLat, baseLon], 16);

    // Apply CartoDB Dark Matter tile layer for a high-tech premium aesthetic
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 20
    }).addTo(map);

    // Custom pulse indicator icon for the vehicle
    const vehicleIcon = L.divIcon({
        className: 'vehicle-marker-pulse',
        html: '<div class="marker-pin"></div><div class="pulse-ring"></div>',
        iconSize: [24, 24],
        iconAnchor: [12, 12]
    });

    // Add geofence boundary circle (Orange glow overlay)
    geofenceCircle = L.circle([baseLat, baseLon], {
        color: '#f59e0b',
        fillColor: '#f59e0b',
        fillOpacity: 0.08,
        radius: geofenceRadius,
        weight: 1.5,
        dashArray: '5, 5'
    }).addTo(map);

    // Add marker
    vehicleMarker = L.marker([baseLat, baseLon], { icon: vehicleIcon }).addTo(map);
    
    // Add path tracker line
    pathPolyline = L.polyline([], {
        color: '#3b82f6',
        weight: 3,
        opacity: 0.85,
        smoothFactor: 1
    }).addTo(map);

    // Bind initial popup
    vehicleMarker.bindPopup("<b>Aegis-Track Active Node</b><br>Initial GPS lock pending...").openPopup();

    // Map Click Listener - Relocate Geofence Base
    map.on('click', function(e) {
        relocateGeofenceCenter(e.latlng.lat, e.latlng.lng);
        logToConsole(`Geofence center updated by map click to: ${e.latlng.lat.toFixed(6)}, ${e.latlng.lng.toFixed(6)}`, "system");
        triggerSecurityAlert("CONFIG UPDATE", `Geofence center relocated to ${e.latlng.lat.toFixed(5)}, ${e.latlng.lng.toFixed(5)}`);
    });
}

// Custom styles for marker pulse injected into head
const styleSheet = document.createElement("style");
styleSheet.innerText = `
.vehicle-marker-pulse {
    position: relative;
}
.marker-pin {
    width: 14px;
    height: 14px;
    background-color: var(--color-blue);
    border: 2px solid #ffffff;
    border-radius: 50%;
    position: absolute;
    top: 5px;
    left: 5px;
    box-shadow: 0 0 10px var(--color-blue-glow);
    transition: all 0.3s ease;
}
.pulse-ring {
    border: 3px solid var(--color-blue);
    border-radius: 30px;
    height: 30px;
    width: 30px;
    position: absolute;
    top: -3px;
    left: -3px;
    animation: marker-pulsate 1.8s ease-out infinite;
    opacity: 0;
}
@keyframes marker-pulsate {
    0% { transform: scale(0.1, 0.1); opacity: 0.0; }
    50% { opacity: 0.8; }
    100% { transform: scale(1.2, 1.2); opacity: 0.0; }
}
.marker-pin-stolen {
    background-color: #ef4444 !important;
    box-shadow: 0 0 10px rgba(239, 68, 68, 0.6) !important;
}
.pulse-ring-stolen {
    border-color: #ef4444 !important;
}
`;
document.head.appendChild(styleSheet);

// ==========================================================================
// INITIALIZE CHART.JS SPEED GRAPH
// ==========================================================================
function initChart() {
    const ctx = document.getElementById('speed-chart').getContext('2d');
    
    // Create subtle visual gradient for line fill
    const gradient = ctx.createLinearGradient(0, 0, 0, 180);
    gradient.addColorStop(0, 'rgba(59, 130, 246, 0.35)');
    gradient.addColorStop(1, 'rgba(59, 130, 246, 0.00)');

    speedChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: chartLabels,
            datasets: [{
                label: 'Speed (km/h)',
                data: speedHistory,
                borderColor: '#3b82f6',
                borderWidth: 2,
                backgroundColor: gradient,
                fill: true,
                tension: 0.4,
                pointRadius: 2,
                pointHoverRadius: 5,
                pointBackgroundColor: '#ffffff',
                pointBorderColor: '#3b82f6'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                x: {
                    grid: { color: 'rgba(255, 255, 255, 0.05)' },
                    ticks: { color: '#64748b', font: { size: 9 } }
                },
                y: {
                    min: 0,
                    max: 80,
                    grid: { color: 'rgba(255, 255, 255, 0.05)' },
                    ticks: { color: '#64748b', font: { size: 9 } }
                }
            }
        }
    });
}

function updateChart(newSpeed) {
    if (!speedChart) return;
    
    // Shift arrays
    speedHistory.push(newSpeed);
    speedHistory.shift();
    
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    chartLabels.push(timeStr);
    chartLabels.shift();
    
    // Recalculate Average Speed
    totalSpeedsRecorded++;
    sumSpeedsRecorded += newSpeed;
    const avg = sumSpeedsRecorded / totalSpeedsRecorded;
    lblAvgSpeed.innerText = `${avg.toFixed(1)} km/h`;
    
    // Update Chart dataset
    speedChart.data.datasets[0].data = speedHistory;
    speedChart.data.labels = chartLabels;
    speedChart.update('none'); // Update without full layout animation (fast)
}

function updateChartColors(primaryHex, glowRgba) {
    if (!speedChart) return;
    
    const ctx = document.getElementById('speed-chart').getContext('2d');
    const gradient = ctx.createLinearGradient(0, 0, 0, 180);
    gradient.addColorStop(0, glowRgba);
    gradient.addColorStop(1, 'rgba(59, 130, 246, 0.00)');

    speedChart.data.datasets[0].borderColor = primaryHex;
    speedChart.data.datasets[0].backgroundColor = gradient;
    speedChart.data.datasets[0].pointBorderColor = primaryHex;
    speedChart.update();
}

// ==========================================================================
// GEOFENCE DYNAMIC CONFIGURATOR
// ==========================================================================
function relocateGeofenceCenter(lat, lon) {
    baseLat = lat;
    baseLon = lon;
    
    // Reposition boundary circle
    geofenceCircle.setLatLng([baseLat, baseLon]);
    
    // Update displayed coordinates
    valGeoCenterLat.innerText = baseLat.toFixed(6);
    valGeoCenterLon.innerText = baseLon.toFixed(6);
}

sliderGeofence.addEventListener('input', function(e) {
    geofenceRadius = parseInt(e.target.value);
    valGeofenceRadius.innerText = geofenceRadius + "m";
    
    // Resize map circle
    geofenceCircle.setRadius(geofenceRadius);
    logToConsole(`Geofence boundary limit resized to: ${geofenceRadius} meters`, "system");
});

btnResetGeofence.addEventListener('click', function() {
    relocateGeofenceCenter(12.9716, 77.5946);
    logToConsole("Geofence center reset to base: 12.971600, 77.594600", "system");
    triggerSecurityAlert("CONFIG UPDATE", "Geofence base coordinates reset to primary station");
});

// ==========================================================================
// AUDIO CONTROLLER
// ==========================================================================
btnAudioToggle.addEventListener('click', function() {
    audioMuted = !audioMuted;
    if (audioMuted) {
        btnAudioToggle.classList.add('muted');
        btnAudioToggle.innerHTML = '<i class="fa-solid fa-volume-xmark"></i>';
        logToConsole("Security siren sounds muted.", "system");
    } else {
        btnAudioToggle.classList.remove('muted');
        btnAudioToggle.innerHTML = '<i class="fa-solid fa-volume-high"></i>';
        logToConsole("Security siren sounds enabled.", "system");
    }
});

// Play browser Audio alert generator (no assets needed)
function playWarningBeep(frequency) {
    if (audioMuted) return;
    try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);

        oscillator.type = 'sine';
        oscillator.frequency.value = frequency;
        gainNode.gain.setValueAtTime(0.08, audioCtx.currentTime); // volume control
        
        oscillator.start();
        oscillator.stop(audioCtx.currentTime + 0.18); 
    } catch (e) {
        // Audio block catch
    }
}

// ==========================================================================
// MQTT SERVICE INTERFACES
// ==========================================================================
function initMQTT() {
    logToConsole("Connecting to MQTT Broker...", "system");
    updateMQTTStatusIndicator("connecting", "Connecting to broker...");

    mqttClient = new Paho.MQTT.Client(MQTT_BROKER_HOST, MQTT_BROKER_PORT, MQTT_PATH, MQTT_CLIENT_ID);
    
    mqttClient.onConnectionLost = onConnectionLost;
    mqttClient.onMessageArrived = onMessageArrived;

    const connectOptions = {
        timeout: 5,
        onSuccess: onConnectSuccess,
        onFailure: onConnectFailure,
        keepAliveInterval: 30
    };

    try {
        mqttClient.connect(connectOptions);
    } catch(err) {
        logToConsole("Connection failed immediately: " + err.message, "err");
        updateMQTTStatusIndicator("disconnected", "Offline");
    }
}

function onConnectSuccess() {
    logToConsole("MQTT Link established successfully!", "system");
    updateMQTTStatusIndicator("connected", "Broker: Connected");

    mqttClient.subscribe(TOPIC_TELEMETRY);
    mqttClient.subscribe(TOPIC_STATUS);
    logToConsole(`Subscribed to: ${TOPIC_TELEMETRY}`, "system");
    logToConsole(`Subscribed to: ${TOPIC_STATUS}`, "system");
}

function onConnectFailure(responseObject) {
    logToConsole("MQTT Connection failed: " + responseObject.errorMessage, "err");
    updateMQTTStatusIndicator("disconnected", "Connection failed. Offline");
}

function onConnectionLost(responseObject) {
    if (responseObject.errorCode !== 0) {
        logToConsole("Connection lost: " + responseObject.errorMessage, "err");
        updateMQTTStatusIndicator("disconnected", "Link Lost. Reconnecting...");
        if (!isDemoMode) {
            setTimeout(initMQTT, 5000);
        }
    }
}

function publishCommand(command) {
    if (isDemoMode) {
        handleLocalCommand(command);
        return;
    }

    if (!mqttClient || !mqttClient.isConnected()) {
        logToConsole("Cannot send command. MQTT client disconnected.", "err");
        return;
    }

    const message = new Paho.MQTT.Message(command);
    message.destinationName = TOPIC_CONTROL;
    mqttClient.send(message);
    logToConsole(`Published Command: [${command}] to ${TOPIC_CONTROL}`, "tx");
}

// ==========================================
// TELEMETRY & ALERTS PROCESSING ENGINE
// ==========================================
function onMessageArrived(message) {
    const topic = message.destinationName;
    const payload = message.payloadString;
    
    logToConsole(`RX: ${payload}`, "rx");

    try {
        const data = JSON.parse(payload);

        if (topic === TOPIC_TELEMETRY) {
            updateTelemetryUI(data);
        } 
        else if (topic === TOPIC_STATUS) {
            handleStatusMessage(data);
        }
    } catch (e) {
        logToConsole("JSON Parse warning: " + payload, "err");
    }
}

function updateTelemetryUI(data) {
    const lat = parseFloat(data.latitude);
    const lon = parseFloat(data.longitude);
    const speed = parseFloat(data.speed);
    const heading = parseFloat(data.heading);
    const satellites = parseInt(data.satellites || 8);
    const engineLocked = data.engine_locked;
    const alertTypeRaw = data.alert_type || "NONE";
    const distance = parseFloat(data.distance_from_base || calculateDistance(baseLat, baseLon, lat, lon));

    // Evaluate alarms against the dynamic geofence settings on user surface
    let finalAlertState = alertTypeRaw;
    if (distance > geofenceRadius) {
        finalAlertState = "GEOFENCE_BREACH";
    } else if (engineLocked && speed > 5.0) {
        finalAlertState = "THEFT_ALERT";
    } else if (alertTypeRaw === "NONE") {
        finalAlertState = "NONE";
    }

    // Update Telemetry Grid Values
    valSpeed.innerHTML = `${speed.toFixed(1)} <span class="unit">km/h</span>`;
    valSats.innerText = satellites;
    valDistance.innerHTML = `${distance.toFixed(0)} <span class="unit">m</span>`;
    displayLatLng.innerText = `GPS Fix: Lat ${lat.toFixed(6)}, Lon ${lon.toFixed(6)}`;

    // Update Chart data point
    updateChart(speed);

    // Enable Google maps routing
    linkGmaps.href = `https://www.google.com/maps?q=${lat},${lon}`;
    linkGmaps.classList.remove('disabled');

    // Ignition State Toggle
    updateIgnitionUI(engineLocked);

    // Alert Status Color change
    if (finalAlertState === "NONE") {
        valGeofence.innerText = distance > geofenceRadius ? "OUT OF ZONE" : "SAFE";
        valGeofence.className = distance > geofenceRadius ? "breach-text" : "safe-text";
    } else {
        valGeofence.innerText = finalAlertState;
        valGeofence.className = "breach-text";
        triggerSecurityAlert(finalAlertState, `Intrusion state logged at coordinate position ${lat.toFixed(5)}, ${lon.toFixed(5)}`);
    }

    // Map Updates: Move marker & append line route paths
    const newLatLng = new L.LatLng(lat, lon);
    vehicleMarker.setLatLng(newLatLng);
    
    // Add path history line (prevent double logging duplicate positions)
    if (routeCoordinates.length === 0 || 
        routeCoordinates[routeCoordinates.length - 1].lat !== lat || 
        routeCoordinates[routeCoordinates.length - 1].lng !== lon) {
        
        routeCoordinates.push(newLatLng);
        pathPolyline.setLatLngs(routeCoordinates);
        
        // Keep camera focused on vehicle
        map.panTo(newLatLng);
    }

    // Adjust visual states in case of active alerts
    const markerEl = vehicleMarker.getElement();
    if (markerEl) {
        const pin = markerEl.querySelector('.marker-pin');
        const ring = markerEl.querySelector('.pulse-ring');
        if (finalAlertState === "THEFT_ALERT" || finalAlertState === "GEOFENCE_BREACH") {
            pin?.classList.add('marker-pin-stolen');
            ring?.classList.add('pulse-ring-stolen');
            vehicleMarker.setPopupContent(`<b>ALARM: ${finalAlertState}!</b><br>Speed: ${speed.toFixed(1)} km/h`).openPopup();
        } else {
            pin?.classList.remove('marker-pin-stolen');
            ring?.classList.remove('pulse-ring-stolen');
            vehicleMarker.setPopupContent(`<b>Vehicle Status</b><br>Speed: ${speed.toFixed(1)} km/h<br>Lock: ${engineLocked ? 'Active' : 'Deactivated'}`);
        }
    }
}

function handleStatusMessage(data) {
    if (data.engine_status) {
        const isLocked = data.engine_status === "LOCKED";
        updateIgnitionUI(isLocked);
    }
    if (data.alert) {
        triggerSecurityAlert("STATUS UPDATE", data.alert);
    }
}

function updateIgnitionUI(isLocked) {
    currentEngineLocked = isLocked;
    if (isLocked) {
        textIgnition.innerText = "LOCKED";
        textIgnition.className = "status-badge state-locked";
        btnLock.disabled = true;
        btnUnlock.disabled = false;
    } else {
        textIgnition.innerText = "UNLOCKED";
        textIgnition.className = "status-badge state-active";
        btnLock.disabled = false;
        btnUnlock.disabled = true;
    }
}

function triggerSecurityAlert(type, message) {
    // Remove "no incidents" template if present
    const emptyMsg = listAlerts.querySelector('.no-alerts-msg');
    if (emptyMsg) {
        listAlerts.removeChild(emptyMsg);
    }

    // Check if alert already displayed to prevent duplication spamming
    const existingAlerts = listAlerts.querySelectorAll('.alert-item');
    for (let el of existingAlerts) {
        if (el.dataset.msg === message && el.dataset.type === type) return;
    }

    const timestamp = new Date().toLocaleTimeString();
    
    // Add to export buffer
    incidentList.push({
        Timestamp: new Date().toLocaleString(),
        Type: type,
        Description: message
    });

    // Create new element
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert-item ${type === 'THEFT_ALERT' ? 'alert-theft' : 'alert-geofence'}`;
    alertDiv.dataset.type = type;
    alertDiv.dataset.msg = message;
    
    alertDiv.innerHTML = `
        <span class="title">
            <i class="fa-solid ${type === 'THEFT_ALERT' ? 'fa-triangle-exclamation' : 'fa-compass'}"></i>
            ${type}
        </span>
        <span>${message}</span>
        <span class="time">${timestamp}</span>
    `;

    listAlerts.insertBefore(alertDiv, listAlerts.firstChild);

    // Play warning sound
    playWarningBeep(type === 'THEFT_ALERT' ? 950 : 650);
}

// ==========================================
// EXPORT SECURITY ALERTS TO CSV
// ==========================================
btnExportAlerts.addEventListener('click', function() {
    if (incidentList.length === 0) {
        logToConsole("Export failed. Incident log contains no records yet.", "err");
        alert("Incident log is currently empty.");
        return;
    }
    
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Timestamp,Alert Type,Description\n";
    
    incidentList.forEach(function(row) {
        csvContent += `"${row.Timestamp}","${row.Type}","${row.Description.replace(/"/g, '""')}"\n`;
    });
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `aegis_incidents_${Date.now()}.csv`);
    document.body.appendChild(link); // Required for FF
    
    link.click();
    document.body.removeChild(link);
    logToConsole("Incident alerts exported as CSV file successfully.", "system");
});

// ==========================================
// SYSTEM ACCENT THEMING SWITCHER
// ==========================================
themeOptions.forEach(opt => {
    opt.addEventListener('click', function() {
        // Remove active class from other options
        themeOptions.forEach(o => o.classList.remove('active'));
        this.classList.add('active');
        
        const theme = this.dataset.theme;
        document.body.className = `theme-${theme}`;
        
        // Get theme-specific values for Chart styling
        let hex = "#3b82f6";
        let rgba = "rgba(59, 130, 246, 0.35)";
        
        if (theme === "cyan") {
            hex = "#06b6d4";
            rgba = "rgba(6, 182, 212, 0.35)";
        } else if (theme === "red") {
            hex = "#f43f5e";
            rgba = "rgba(244, 63, 94, 0.35)";
        } else if (theme === "green") {
            hex = "#10b981";
            rgba = "rgba(16, 185, 129, 0.35)";
        }
        
        updateChartColors(hex, rgba);
        logToConsole(`Dashboard theme swapped to: ${theme.toUpperCase()}`, "system");
    });
});

// ==========================================
// VIRTUAL VEHICLE DEMO ENGINE
// ==========================================
let demoTick = 0;
let demoLat = baseLat;
let demoLon = baseLon;

function startDemoMode() {
    isDemoMode = true;
    demoTick = 0;
    demoLat = baseLat;
    demoLon = baseLon;
    routeCoordinates = [];
    pathPolyline.setLatLngs([]);
    
    if (mqttClient && mqttClient.isConnected()) {
        mqttClient.disconnect();
    }
    
    updateMQTTStatusIndicator("disconnected", "Mode: VIRTUAL DEMO SIMULATOR");
    logToConsole("Initializing local vehicle simulation sequence...", "system");
    triggerSecurityAlert("SYSTEM", "Entering mock tracking demonstration mode");

    btnDemo.innerHTML = '<i class="fa-solid fa-stop"></i> Stop Demo Mode';
    btnDemo.className = 'btn btn-danger';

    // Clear chart averages
    totalSpeedsRecorded = 0;
    sumSpeedsRecorded = 0;

    demoInterval = setInterval(() => {
        demoTick++;
        let speed = 40.0;
        let heading = (demoTick * 15) % 360;
        let alertType = "NONE";
        
        // 4 Scenarios driven by timeline
        if (demoTick <= 10) {
            speed = 42.5 + Math.sin(demoTick) * 5;
            let rad = heading * Math.PI / 180;
            demoLat += (speed * 0.27 * Math.cos(rad) * 2) * 0.000009;
            demoLon += (speed * 0.27 * Math.sin(rad) * 2) * 0.000009;
        } 
        else if (demoTick > 10 && demoTick <= 20) {
            speed = Math.max(0, 40.0 - (demoTick - 10) * 8);
            if (demoTick === 11) {
                handleLocalCommand("LOCK");
            }
            if (speed > 0) {
                let rad = heading * Math.PI / 180;
                demoLat += (speed * 0.27 * Math.cos(rad) * 2) * 0.000009;
                demoLon += (speed * 0.27 * Math.sin(rad) * 2) * 0.000009;
            }
        } 
        else if (demoTick > 20 && demoTick <= 30) {
            speed = (demoTick - 20) * 8; 
            alertType = "THEFT_ALERT";
            heading = 270; 
            let rad = heading * Math.PI / 180;
            demoLat += (speed * 0.27 * Math.cos(rad) * 2) * 0.000009;
            demoLon += (speed * 0.27 * Math.sin(rad) * 2) * 0.000009;
        }
        else {
            speed = 65.0;
            heading = 315; 
            alertType = "GEOFENCE_BREACH";
            let rad = heading * Math.PI / 180;
            demoLat += (speed * 0.27 * Math.cos(rad) * 2) * 0.000009;
            demoLon += (speed * 0.27 * Math.sin(rad) * 2) * 0.000009;
        }

        let dist = calculateDistance(baseLat, baseLon, demoLat, demoLon);

        const mockTelemetry = {
            latitude: demoLat,
            longitude: demoLon,
            speed: speed,
            heading: heading,
            satellites: 9,
            engine_locked: currentEngineLocked,
            alert_type: alertType,
            distance_from_base: dist,
            timestamp: new Date().toISOString()
        };

        updateTelemetryUI(mockTelemetry);
        logToConsole(`SIMULATION FEED: ${JSON.stringify(mockTelemetry)}`, "rx");

        if (demoTick >= 40) {
            logToConsole("Simulation run completed. Looping simulation path...", "system");
            demoTick = 0;
            demoLat = baseLat;
            demoLon = baseLon;
        }

    }, 2000);
}

function stopDemoMode() {
    isDemoMode = false;
    clearInterval(demoInterval);
    btnDemo.innerHTML = '<i class="fa-solid fa-play"></i> Run Live Demo Mode';
    btnDemo.className = 'btn btn-primary';
    logToConsole("Simulating stopped. Reconnecting to IoT Network...", "system");
    initMQTT();
}

function handleLocalCommand(command) {
    logToConsole(`Local Simulator RX: Received ignition override cmd [${command}]`, "tx");
    if (command === "LOCK") {
        updateIgnitionUI(true);
        triggerSecurityAlert("IGNITION RELAY", "Engine ignition disabled via lock command");
    } else {
        updateIgnitionUI(false);
        triggerSecurityAlert("IGNITION RELAY", "Engine ignition allowed via unlock command");
    }
}

// ==========================================
// UTILITIES
// ==========================================
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3; // Earth radius in meters
    const phi1 = lat1 * Math.PI/180;
    const phi2 = lat2 * Math.PI/180;
    const deltaPhi = (lat2-lat1) * Math.PI/180;
    const deltaLambda = (lon2-lon1) * Math.PI/180;

    const a = Math.sin(deltaPhi/2) * Math.sin(deltaPhi/2) +
              Math.cos(phi1) * Math.cos(phi2) *
              Math.sin(deltaLambda/2) * Math.sin(deltaLambda/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c; // in meters
}

function logToConsole(message, type = "normal") {
    const line = document.createElement('div');
    line.className = `console-line ${type}-msg`;
    line.innerText = `[${new Date().toLocaleTimeString()}] ${message}`;
    
    consoleOutput.appendChild(line);
    consoleOutput.scrollTop = consoleOutput.scrollHeight; 

    while (consoleOutput.children.length > 50) {
        consoleOutput.removeChild(consoleOutput.firstChild);
    }
}

function updateMQTTStatusIndicator(status, text) {
    textMqttStatus.innerText = text;
    indicatorMqtt.className = "indicator";
    if (status === "connected") {
        indicatorMqtt.classList.add('status-connected');
    } else if (status === "disconnected") {
        indicatorMqtt.classList.add('status-disconnected');
    }
}

// ==========================================================================
// BIND EVENT HANDLERS
// ==========================================================================
btnLock.addEventListener('click', () => publishCommand("LOCK"));
btnUnlock.addEventListener('click', () => publishCommand("UNLOCK"));

btnDemo.addEventListener('click', () => {
    if (isDemoMode) {
        stopDemoMode();
    } else {
        startDemoMode();
    }
});

btnClearLogs.addEventListener('click', () => {
    consoleOutput.innerHTML = '<div class="console-line system-msg">[SYSTEM] Console buffer cleared. Awaiting telemetry...</div>';
    logToConsole("Diagnostic console logs cleared locally.", "system");
});

// Initialize Page components
window.addEventListener('DOMContentLoaded', () => {
    initMap();
    initChart();
    initMQTT();
});
