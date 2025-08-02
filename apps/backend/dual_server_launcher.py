# dual_server_launcher.py
import threading
import time
import logging
import subprocess
import sys

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - [LAUNCHER] - %(levelname)s - %(message)s'
)
logger = logging.getLogger("DualServerLauncher")

def run_server_5001():
    """Run the simple server on port 5001."""
    try:
        logger.info("🚀 Starting Simple Server (Port 5001)...")
        # Import and run the first server
        import fyers_data  # Your first modified code file
        fyers_data.main()
    except Exception as e:
        logger.error(f"❌ Error in server 5001: {e}")

def run_server_5010():
    """Run the multi-company server on port 5010."""
    try:
        logger.info("🚀 Starting Multi-Company Server (Port 5010)...")
        # Import and run the second server
        import multi_company_live_data  # Your second modified code file
        multi_company_live_data.main()
    except Exception as e:
        logger.error(f"❌ Error in server 5010: {e}")

def main():
    """Launch both servers in parallel."""
    logger.info("🎯 Extreme Pro Dual-Port Market Server Launcher")
    logger.info("=" * 60)
    
    # Create threads for both servers
    thread_5001 = threading.Thread(target=run_server_5001, daemon=True)
    thread_5010 = threading.Thread(target=run_server_5010, daemon=True)
    
    # Start both servers
    thread_5001.start()
    time.sleep(2)  # Small delay between starts
    thread_5010.start()
    
    logger.info("✅ Both servers started successfully!")
    logger.info("📡 Port 5001: Simple single-company subscriptions")
    logger.info("📡 Port 5010: Advanced multi-company subscriptions")
    logger.info("🔗 Authentication: /api/auth/* endpoints on both ports")
    
    try:
        # Keep main thread alive
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        logger.info("🛑 Shutting down both servers...")

if __name__ == "__main__":
    main()
