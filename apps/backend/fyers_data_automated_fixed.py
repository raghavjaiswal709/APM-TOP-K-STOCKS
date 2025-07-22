import eventlet
eventlet.monkey_patch()

import socketio
import json
import sys
import time
import datetime
import pytz
import threading
import logging
import requests
import numpy as np
import os
import webbrowser
from collections import deque
from fyers_apiv3 import fyersModel
from fyers_apiv3.FyersWebsocket import data_ws

# Fix Windows Unicode encoding issue
if sys.platform.startswith('win'):
    import codecs
    sys.stdout = codecs.getwriter('utf-8')(sys.stdout.buffer, 'strict')
    sys.stderr = codecs.getwriter('utf-8')(sys.stderr.buffer, 'strict')

# Enhanced logging with UTF-8 encoding
class UTFFormatter(logging.Formatter):
    def format(self, record):
        # Replace emojis with simple text for Windows compatibility
        msg = super().format(record)
        emoji_replacements = {
            '🚀': '[START]',
            '📌': '[PIN]',
            '🔐': '[LOCK]',
            '🌐': '[WEB]',
            '✅': '[OK]',
            '❌': '[ERROR]',
            '🔑': '[KEY]',
            '⏳': '[WAIT]',
            '🛑': '[STOP]',
            '📄': '[FILE]',
            '🎉': '[SUCCESS]'
        }
        
        for emoji, replacement in emoji_replacements.items():
            msg = msg.replace(emoji, replacement)
        
        return msg

# Setup logging with custom formatter
log_formatter = UTFFormatter('%(asctime)s - %(levelname)s - %(message)s')

file_handler = logging.FileHandler(
    f'fyers_data_{datetime.datetime.now().strftime("%Y%m%d")}.log',
    encoding='utf-8'
)
file_handler.setFormatter(log_formatter)

console_handler = logging.StreamHandler()
console_handler.setFormatter(log_formatter)

logger = logging.getLogger("AutomatedFyersServer")
logger.setLevel(logging.INFO)
logger.addHandler(file_handler)
logger.addHandler(console_handler)

# Socket.IO setup
sio = socketio.Server(cors_allowed_origins='*', async_mode='eventlet')
app = socketio.WSGIApp(sio)

# Configuration
client_id = "150HUKJSWG-100"
secret_key = "18YYNXCAS7"
redirect_uri = "https://daksphere.com"
response_type = "code"
grant_type = "authorization_code"

# Global variables
clients = {}
symbol_to_clients = {}
running = True
historical_data = {}
ohlc_data = {}
MAX_HISTORY_POINTS = 10000
INDIA_TZ = pytz.timezone('Asia/Kolkata')
fyers = None
fyers_client = None
auth_completed = threading.Event()
access_token = None

class AutomatedAuthHandler:
    def __init__(self):
        self.auth_file_path = os.path.join('data', 'fyers_data_auth.json')
        self.polling_interval = 2  # seconds
        self.max_wait_time = 300  # 5 minutes
        
    def wait_for_auth_completion(self):
        """Wait for authentication to be completed via web interface"""
        logger.info("[LOCK] Starting automated authentication process...")
        
        # Generate auth URL and open browser
        auth_url = self.generate_auth_url()
        logger.info(f"[WEB] Opening browser with auth URL: {auth_url}")
        
        try:
            webbrowser.open(auth_url)
            logger.info("[OK] Browser opened successfully")
        except Exception as e:
            logger.error(f"[ERROR] Failed to open browser: {e}")
            logger.info(f"Please manually open: {auth_url}")
        
        # Poll for auth completion
        start_time = time.time()
        while not auth_completed.is_set():
            if time.time() - start_time > self.max_wait_time:
                logger.error("[ERROR] Authentication timeout. Please try again.")
                return None
                
            if self.check_auth_file():
                logger.info("[OK] Authentication completed!")
                return self.load_auth_data()
                
            time.sleep(self.polling_interval)
            logger.debug("[WAIT] Waiting for authentication...")
            
        return None
    
    def generate_auth_url(self):
        """Generate Fyers auth URL"""
        return f"https://api-t2.fyers.in/api/v3/generate-authcode?client_id={client_id}&redirect_uri={redirect_uri}&response_type=code&state=fyers_oauth"
    
    def check_auth_file(self):
        """Check if auth file exists and is recent"""
        try:
            if not os.path.exists(self.auth_file_path):
                return False
                
            # Check if file is recent (within last 5 minutes)
            file_age = time.time() - os.path.getmtime(self.auth_file_path)
            if file_age > 300:  # 5 minutes
                return False
                
            with open(self.auth_file_path, 'r') as f:
                auth_data = json.load(f)
                return 'access_token' in auth_data and auth_data.get('service') == 'fyers_data'
                
        except Exception as e:
            logger.error(f"Error checking auth file: {e}")
            return False
    
    def load_auth_data(self):
        """Load authentication data from file"""
        try:
            with open(self.auth_file_path, 'r') as f:
                auth_data = json.load(f)
                logger.info("[FILE] Loaded authentication data from file")
                return auth_data
        except Exception as e:
            logger.error(f"Error loading auth data: {e}")
            return None

# WebSocket event handlers
@sio.event
def connect(sid, environ):
    logger.info(f"Client connected: {sid}")
    clients[sid] = {'subscriptions': set()}

@sio.event
def disconnect(sid):
    logger.info(f"Client disconnected: {sid}")
    if sid in clients:
        for symbol in clients[sid]['subscriptions']:
            if symbol in symbol_to_clients:
                symbol_to_clients[symbol].discard(sid)
        del clients[sid]

@sio.event
def subscribe(sid, data):
    """Handle subscription requests from clients"""
    if sid not in clients:
        logger.warning(f"Unknown client {sid} trying to subscribe")
        return
    
    symbols = data.get('symbols', [])
    logger.info(f"Client {sid} subscribing to {len(symbols)} symbols")
    
    for symbol in symbols:
        if symbol not in symbol_to_clients:
            symbol_to_clients[symbol] = set()
        symbol_to_clients[symbol].add(sid)
        clients[sid]['subscriptions'].add(symbol)
        
        # Subscribe to Fyers WebSocket if available
        if fyers and hasattr(fyers, 'subscribe'):
            try:
                fyers.subscribe(symbol=[symbol], data_type="SymbolUpdate")
                logger.info(f"Subscribed to Fyers symbol: {symbol}")
            except Exception as e:
                logger.error(f"Failed to subscribe to {symbol}: {e}")

@sio.event
def unsubscribe(sid, data):
    """Handle unsubscription requests from clients"""
    if sid not in clients:
        return
    
    symbols = data.get('symbols', [])
    logger.info(f"Client {sid} unsubscribing from {len(symbols)} symbols")
    
    for symbol in symbols:
        if symbol in symbol_to_clients:
            symbol_to_clients[symbol].discard(sid)
            if not symbol_to_clients[symbol]:
                del symbol_to_clients[symbol]
                
                # Unsubscribe from Fyers WebSocket if no clients left
                if fyers and hasattr(fyers, 'unsubscribe'):
                    try:
                        fyers.unsubscribe(symbol=[symbol])
                        logger.info(f"Unsubscribed from Fyers symbol: {symbol}")
                    except Exception as e:
                        logger.error(f"Failed to unsubscribe from {symbol}: {e}")
        
        clients[sid]['subscriptions'].discard(symbol)

@sio.event
def auth_token_ready(sid, data):
    """Handle auth token ready event from web interface"""
    global access_token, fyers_client, fyers
    
    logger.info("[KEY] Received auth token from web interface")
    access_token = data.get('access_token')
    auth_code = data.get('auth_code')
    
    if access_token:
        try:
            # Initialize Fyers client
            fyers_client = fyersModel.FyersModel(
                client_id=client_id,
                token=access_token.replace(f"{client_id}:", ""),
                log_path=""
            )
            
            # Initialize WebSocket
            fyers = data_ws.FyersDataSocket(
                access_token=access_token,
                log_path="",
                litemode=False,
                write_to_file=False,
                reconnect=True,
                on_connect=onopen,
                on_close=onclose,
                on_error=onerror,
                on_message=onmessage
            )
            
            logger.info("[OK] Fyers client and WebSocket initialized")
            auth_completed.set()
            
        except Exception as e:
            logger.error(f"[ERROR] Error initializing Fyers: {e}")

def onmessage(message):
    """Handle incoming Fyers WebSocket messages"""
    logger.debug(f"Response: {message}")
    
    if isinstance(message, dict) and message.get('type') == 'sub':
        logger.info(f"Subscription confirmation: {message}")
        return
    
    if isinstance(message, dict) and 'symbol' in message:
        symbol = message['symbol']
        
        # Add timestamp if not present
        current_time = int(time.time())
        ist_time = datetime.datetime.fromtimestamp(current_time, INDIA_TZ)
        
        simplified_data = {
            'symbol': symbol,
            'ltp': message.get('ltp', 0),
            'change': message.get('ch', 0),
            'changePercent': message.get('chp', 0),
            'volume': message.get('vol_traded_today', 0),
            'open': message.get('open_price', 0),
            'high': message.get('high_price', 0),
            'low': message.get('low_price', 0),
            'close': message.get('prev_close_price', 0),
            'bid': message.get('bid_price', 0),
            'ask': message.get('ask_price', 0),
            'timestamp': message.get('last_traded_time', current_time),
            'formatted_time': ist_time.strftime("%H:%M:%S")
        }
        
        # Store historical data
        if symbol not in historical_data:
            historical_data[symbol] = deque(maxlen=MAX_HISTORY_POINTS)
        
        historical_data[symbol].append({
            'timestamp': current_time,
            'ltp': simplified_data['ltp'],
            'volume': simplified_data['volume']
        })
        
        # Send data to subscribed clients
        if symbol in symbol_to_clients:
            for sid in list(symbol_to_clients[symbol]):  # Create copy to avoid modification during iteration
                try:
                    sio.emit('marketData', simplified_data, room=sid)
                except Exception as e:
                    logger.error(f"Error sending data to client {sid}: {e}")
                    # Remove disconnected client
                    symbol_to_clients[symbol].discard(sid)
                    if sid in clients:
                        del clients[sid]

def onopen():
    logger.info("[OK] Fyers WebSocket connected")
    sio.emit('fyersConnected', {'status': 'connected'})

def onerror(error):
    logger.error(f"[ERROR] Fyers WebSocket Error: {error}")
    sio.emit('error', {'message': str(error)})

def onclose(message):
    logger.info(f"[ERROR] Fyers WebSocket Connection closed: {message}")
    sio.emit('fyersDisconnected', {'message': str(message)})

def main_process():
    """Main automated process"""
    global fyers, fyers_client, running, access_token
    
    try:
        # Create data directory
        os.makedirs('data', exist_ok=True)
        
        # Start automated authentication
        auth_handler = AutomatedAuthHandler()
        auth_data = auth_handler.wait_for_auth_completion()
        
        if not auth_data:
            logger.error("[ERROR] Authentication failed or timed out")
            return
            
        access_token = auth_data.get('access_token')
        if not access_token:
            logger.error("[ERROR] No access token received")
            return
            
        # Initialize Fyers client
        token_only = access_token.replace(f"{client_id}:", "") if access_token.startswith(client_id) else access_token
        
        fyers_client = fyersModel.FyersModel(
            client_id=client_id,
            token=token_only,
            log_path=""
        )
        
        # Initialize WebSocket
        fyers = data_ws.FyersDataSocket(
            access_token=access_token if access_token.startswith(client_id) else f"{client_id}:{access_token}",
            log_path="",
            litemode=False,
            write_to_file=False,
            reconnect=True,
            on_connect=onopen,
            on_close=onclose,
            on_error=onerror,
            on_message=onmessage
        )
        
        logger.info("[START] Starting Fyers WebSocket connection...")
        fyers.connect()
        
        logger.info("[WEB] Starting Socket.IO server on port 5001...")
        eventlet.wsgi.server(eventlet.listen(('0.0.0.0', 5001)), app)
        
    except Exception as e:
        logger.error(f"[ERROR] Error in main process: {e}")
        import traceback
        traceback.print_exc()

def main():
    global running
    
    logger.info("[START] Starting Automated Fyers Data Server...")
    logger.info("[PIN] Authentication will be handled automatically through web interface")
    
    try:
        eventlet.spawn(main_process)
        
        while running:
            time.sleep(1)
    except KeyboardInterrupt:
        logger.info("[STOP] Shutting down...")
        running = False

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        logger.info("[STOP] Shutting down...")
        running = False
    except Exception as e:
        logger.error(f"[ERROR] Fatal error: {e}")
        import traceback
        traceback.print_exc()
