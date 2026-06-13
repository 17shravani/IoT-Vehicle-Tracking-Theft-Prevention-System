import os
import csv
from datetime import datetime
import math

# Output Directories
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, "data")
REPORT_DIR = os.path.join(BASE_DIR, "reports")
LOG_FILE = os.path.join(DATA_DIR, "vehicle_logs.csv")

# Ensure directories exist
os.makedirs(DATA_DIR, exist_ok=True)
os.makedirs(REPORT_DIR, exist_ok=True)

def generate_dummy_data():
    """Generates sample coordinates if none exist to enable instant report testing."""
    print("[REPORTER] CSV logs not found or empty. Generating sample coordinate history...")
    
    start_time = datetime.now()
    base_lat, base_lon = 12.9716, 77.5946
    
    records = []
    # 20 records simulating a drive
    for i in range(20):
        # Calculate time (every 30 seconds)
        timestamp = (start_time.replace(second=0, microsecond=0)).strftime("%Y-%m-%d %H:%M:%S")
        
        # Calculate coordinate updates (driving circular)
        angle = (i * 18) * (math.pi / 180.0)
        speed = 40.0 + (5.0 * math.sin(i))
        lat = base_lat + (0.0001 * i * math.cos(angle))
        lon = base_lon + (0.0001 * i * math.sin(angle))
        
        # Simulating states
        engine_status = "UNLOCKED"
        alert = "NONE"
        if i >= 18:
            alert = "GEOFENCE_BREACH"
        elif i == 10:
            engine_status = "LOCKED"
            alert = "THEFT_ALERT"
            speed = 0.0
            
        records.append([timestamp, f"{lat:.6f}", f"{lon:.6f}", f"{speed:.2f}", f"{18.0 * i:.1f}", engine_status, alert])
        # Advance time by 30 seconds
        start_time = datetime.fromtimestamp(start_time.timestamp() + 30)

    with open(LOG_FILE, mode="w", newline="") as file:
        writer = csv.writer(file)
        writer.writerow(["Timestamp", "Latitude", "Longitude", "Speed", "Heading", "Engine_Status", "Alert_Type"])
        writer.writerows(records)
    print(f"[REPORTER] Created mock coordinate logs at: {LOG_FILE}")

def parse_logs():
    """Reads telemetry logs from CSV and returns statistics & records."""
    if not os.path.exists(LOG_FILE) or os.path.getsize(LOG_FILE) < 10:
        generate_dummy_data()

    records = []
    total_records = 0
    total_speed = 0.0
    max_speed = 0.0
    theft_alarms = 0
    geofence_alarms = 0
    
    with open(LOG_FILE, mode="r") as file:
        reader = csv.reader(file)
        header = next(reader, None) # Skip header
        for row in reader:
            if not row or len(row) < 7:
                continue
            
            timestamp = row[0]
            lat = float(row[1])
            lon = float(row[2])
            speed = float(row[3])
            heading = float(row[4])
            engine = row[5]
            alert = row[6]
            
            total_records += 1
            total_speed += speed
            if speed > max_speed:
                max_speed = speed
            
            if alert == "THEFT_ALERT":
                theft_alarms += 1
            elif alert == "GEOFENCE_BREACH":
                geofence_alarms += 1
                
            records.append({
                "time": timestamp,
                "lat": lat,
                "lon": lon,
                "speed": speed,
                "heading": heading,
                "engine": engine,
                "alert": alert
            })

    avg_speed = total_speed / total_records if total_records > 0 else 0.0
    
    stats = {
        "total_records": total_records,
        "avg_speed": avg_speed,
        "max_speed": max_speed,
        "theft_alarms": theft_alarms,
        "geofence_alarms": geofence_alarms,
        "start_time": records[0]["time"] if records else "N/A",
        "end_time": records[-1]["time"] if records else "N/A"
    }
    
    return records, stats

def generate_csv_summary(stats):
    """Generates a CSV file summarizing session performance."""
    summary_path = os.path.join(REPORT_DIR, "session_summary.csv")
    with open(summary_path, mode="w", newline="") as file:
        writer = csv.writer(file)
        writer.writerow(["Metric", "Value"])
        writer.writerow(["Report Date", datetime.now().strftime("%Y-%m-%d %H:%M:%S")])
        writer.writerow(["Trip Start Time", stats["start_time"]])
        writer.writerow(["Trip End Time", stats["end_time"]])
        writer.writerow(["Total Logs Collected", stats["total_records"]])
        writer.writerow(["Average Speed (km/h)", f"{stats['avg_speed']:.2f}"])
        writer.writerow(["Maximum Speed (km/h)", f"{stats['max_speed']:.2f}"])
        writer.writerow(["Theft Alerts Count", stats["theft_alarms"]])
        writer.writerow(["Geofence Breaches Count", stats["geofence_alarms"]])
    print(f"[REPORTER] Summary CSV report saved to: {summary_path}")

def generate_pdf_report(records, stats):
    """Generates a beautiful PDF report with tables and styling using ReportLab."""
    pdf_path = os.path.join(REPORT_DIR, "telemetry_report.pdf")
    
    try:
        from reportlab.lib.pagesizes import letter
        from reportlab.lib import colors
        from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    except ImportError:
        print("[REPORTER WARNING] ReportLab is not installed. PDF generation skipped.")
        print("[REPORTER TIP] Run 'pip install reportlab' to enable PDF generation.")
        return

    # Create document
    doc = SimpleDocTemplate(pdf_path, pagesize=letter, rightMargin=36, leftMargin=36, topMargin=36, bottomMargin=36)
    story = []
    
    styles = getSampleStyleSheet()
    
    # Custom styles
    title_style = ParagraphStyle(
        'TitleStyle',
        parent=styles['Heading1'],
        fontSize=22,
        leading=26,
        textColor=colors.HexColor('#0f172a'), # slate-900
        spaceAfter=15
    )
    
    subtitle_style = ParagraphStyle(
        'SubtitleStyle',
        parent=styles['Normal'],
        fontSize=10,
        leading=14,
        textColor=colors.HexColor('#64748b'), # slate-500
        spaceAfter=20
    )
    
    th_style = ParagraphStyle(
        'TableHeader',
        parent=styles['Normal'],
        fontSize=9,
        leading=11,
        textColor=colors.white,
        fontName='Helvetica-Bold'
    )
    
    td_style = ParagraphStyle(
        'TableCell',
        parent=styles['Normal'],
        fontSize=8,
        leading=10,
        textColor=colors.HexColor('#334155')
    )
    
    # Header Section
    story.append(Paragraph("IoT Vehicle Tracking & Security Report", title_style))
    story.append(Paragraph(f"Generated on {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} | Device: IoT-TRK-ESP32-001", subtitle_style))
    story.append(Spacer(1, 10))
    
    # Statistics Table
    stats_data = [
        [
            Paragraph("<b>Start Time:</b> " + stats["start_time"], td_style),
            Paragraph("<b>Average Speed:</b> " + f"{stats['avg_speed']:.2f} km/h", td_style),
            Paragraph("<b>Theft Alarms:</b> <font color='red'><b>" + str(stats["theft_alarms"]) + "</b></font>", td_style)
        ],
        [
            Paragraph("<b>End Time:</b> " + stats["end_time"], td_style),
            Paragraph("<b>Maximum Speed:</b> " + f"{stats['max_speed']:.2f} km/h", td_style),
            Paragraph("<b>Geofence Breaches:</b> <font color='orange'><b>" + str(stats["geofence_alarms"]) + "</b></font>", td_style)
        ]
    ]
    
    stats_table = Table(stats_data, colWidths=[200, 170, 170])
    stats_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#f8fafc')), # slate-50
        ('ALIGN', (0,0), (-1,-1), 'LEFT'),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('BOTTOMPADDING', (0,0), (-1,-1), 8),
        ('TOPPADDING', (0,0), (-1,-1), 8),
        ('LEFTPADDING', (0,0), (-1,-1), 12),
        ('RIGHTPADDING', (0,0), (-1,-1), 12),
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor('#e2e8f0')), # slate-200
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor('#f1f5f9')), # slate-100
    ]))
    
    story.append(Paragraph("<b>Trip Summary</b>", ParagraphStyle('H2', parent=styles['Heading2'], fontSize=12, leading=16, textColor=colors.HexColor('#1e293b'), spaceAfter=8)))
    story.append(stats_table)
    story.append(Spacer(1, 20))
    
    # Detailed Logs Table
    log_data = [[
        Paragraph("Timestamp", th_style),
        Paragraph("Coordinates", th_style),
        Paragraph("Speed", th_style),
        Paragraph("Heading", th_style),
        Paragraph("Engine Status", th_style),
        Paragraph("Alert Type", th_style)
    ]]
    
    for r in records:
        alert_str = r["alert"]
        if alert_str == "THEFT_ALERT":
            alert_cell = Paragraph("<font color='red'><b>THEFT</b></font>", td_style)
        elif alert_str == "GEOFENCE_BREACH":
            alert_cell = Paragraph("<font color='orange'><b>OUT OF ZONE</b></font>", td_style)
        else:
            alert_cell = Paragraph("None", td_style)
            
        engine_str = r["engine"]
        if engine_str == "LOCKED":
            engine_cell = Paragraph("<font color='red'>Locked</font>", td_style)
        else:
            engine_cell = Paragraph("Unlocked", td_style)

        log_data.append([
            Paragraph(r["time"], td_style),
            Paragraph(f"{r['lat']:.5f}, {r['lon']:.5f}", td_style),
            Paragraph(f"{r['speed']:.1f} km/h", td_style),
            Paragraph(f"{r['heading']:.0f}°", td_style),
            engine_cell,
            alert_cell
        ])
        
    log_table = Table(log_data, colWidths=[110, 120, 70, 60, 80, 100])
    log_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#0f172a')), # slate-900 header
        ('ALIGN', (0,0), (-1,-1), 'LEFT'),
        ('BOTTOMPADDING', (0,0), (-1,-1), 5),
        ('TOPPADDING', (0,0), (-1,-1), 5),
        ('LEFTPADDING', (0,0), (-1,-1), 8),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, colors.HexColor('#f8fafc')]),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#cbd5e1')), # slate-300
    ]))
    
    story.append(Paragraph("<b>Detailed Coordinate Logs</b>", ParagraphStyle('H2', parent=styles['Heading2'], fontSize=12, leading=16, textColor=colors.HexColor('#1e293b'), spaceAfter=8)))
    story.append(log_table)
    
    # Build document
    doc.build(story)
    print(f"[REPORTER] PDF report saved to: {pdf_path}")

def main():
    print("--- Running IoT Report Generation Service ---")
    records, stats = parse_logs()
    
    # Write CSV summary
    generate_csv_summary(stats)
    
    # Write PDF report
    generate_pdf_report(records, stats)
    
    print("\n[REPORTER] Success! Reporting services run complete.")

if __name__ == "__main__":
    main()
