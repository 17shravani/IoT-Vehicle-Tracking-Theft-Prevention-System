import os
import sys
import argparse
import subprocess
import http.server
import socketserver
import threading
import webbrowser

# Project Directory Paths
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
SIM_SCRIPT = os.path.join(BASE_DIR, "python_simulation", "sim_tracker.py")
REPORT_SCRIPT = os.path.join(BASE_DIR, "python_simulation", "report_generator.py")
DASHBOARD_DIR = os.path.join(BASE_DIR, "dashboard")

def run_simulation(mode):
    """Executes the Python GPS simulation subprocess."""
    print(f"\n[SYSTEM] Starting vehicle simulator in '{mode}' mode...")
    try:
        subprocess.run([sys.executable, SIM_SCRIPT, "--mode", mode], check=True)
    except KeyboardInterrupt:
        print("\n[SYSTEM] Simulation terminated by user.")
    except Exception as e:
        print(f"[SYSTEM ERROR] Failed to run simulation: {e}")

def run_report():
    """Executes the PDF and CSV report generator subprocess."""
    print("\n[SYSTEM] Starting report generator...")
    try:
        subprocess.run([sys.executable, REPORT_SCRIPT], check=True)
    except Exception as e:
        print(f"[SYSTEM ERROR] Failed to generate reports: {e}")

def start_dashboard_server(port=8085):
    """Starts a local HTTP Web server to serve the Leaflet.js dashboard UI."""
    os.chdir(DASHBOARD_DIR)
    Handler = http.server.SimpleHTTPRequestHandler
    
    # Allow port reuse to avoid 'Address already in use' errors during rapid restarts
    class TCPServerReusable(socketserver.TCPServer):
        allow_reuse_address = True
        
    try:
        with TCPServerReusable(("", port), Handler) as httpd:
            url = f"http://localhost:{port}"
            print(f"\n==============================================")
            print(f"🖥️ Aegis-Track Dashboard Server Active!")
            print(f"URL: {url}")
            print(f"Serving files from: {DASHBOARD_DIR}")
            print(f"Press CTRL+C to terminate the server")
            print(f"==============================================\n")
            
            # Automatically open browser window
            threading.Timer(1.5, lambda: webbrowser.open(url)).start()
            httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n[SYSTEM] Web server stopped.")
    except Exception as e:
        print(f"[SYSTEM ERROR] Failed to start web server on port {port}: {e}")

def main():
    parser = argparse.ArgumentParser(description="Aegis-Track IoT Vehicle Tracker CLI Control Center")
    
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument(
        "--sim", 
        type=str, 
        choices=["normal", "parked", "stolen", "geofence_exit"],
        help="Run simulated vehicle telemetry (normal, parked, stolen, geofence_exit)"
    )
    group.add_argument(
        "--dashboard", 
        action="store_true",
        help="Start the dashboard local web server and open it in the browser"
    )
    group.add_argument(
        "--report", 
        action="store_true",
        help="Generate trip telemetry reports (PDF & CSV)"
    )
    
    parser.add_argument(
        "--port", 
        type=int, 
        default=8085,
        help="Port number for the dashboard web server (default: 8085)"
    )

    args = parser.parse_args()

    if args.sim:
        run_simulation(args.sim)
    elif args.report:
        run_report()
    elif args.dashboard:
        start_dashboard_server(args.port)

if __name__ == "__main__":
    main()
