import subprocess
import sys
import time
import threading

def start_service(script_name, port):
    """Start a service script."""
    try:
        print(f"🚀 Starting {script_name} on port {port}...")
        process = subprocess.Popen([sys.executable, script_name])
        return process
    except Exception as e:
        print(f"❌ Error starting {script_name}: {e}")
        return None

def main():
    """Start both services."""
    print("=" * 60)
    print("🚀 Starting Fyers Dual Service Setup")
    print("📡 Service 5001: Historical Data")
    print("📡 Service 5010: Real-time Market Data")
    print("=" * 60)
    
    # Start both services
    service_5001 = start_service('fyers_service_5001.py', 5001)
    time.sleep(2)  # Small delay
    service_5010 = start_service('fyers_service_5010.py', 5010)
    
    if service_5001 and service_5010:
        print("✅ Both services started successfully")
        print("📡 Service 5001: http://localhost:5001")
        print("📡 Service 5010: http://localhost:5010")
        
        try:
            # Wait for both processes
            service_5001.wait()
            service_5010.wait()
        except KeyboardInterrupt:
            print("\n🛑 Shutting down services...")
            service_5001.terminate()
            service_5010.terminate()
    else:
        print("❌ Failed to start one or both services")

if __name__ == "__main__":
    main()
