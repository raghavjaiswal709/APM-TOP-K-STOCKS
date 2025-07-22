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
from urllib.parse import quote_plus
from fyers_apiv3 import fyersModel
from fyers_apiv3.FyersWebsocket import data_ws

# Fix Windows Unicode encoding issue
if sys.platform.startswith('win'):
    import codecs
    sys.stdout = codecs.getwriter('utf-8')(sys.stdout.buffer, 'strict')
    sys.stderr = codecs.getwriter('utf-8')(sys.stderr.buffer, 'strict')

# Enhanced logging with UTF-8 encoding
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(
            f'fyers_data_{datetime.datetime.now().strftime("%Y%m%d")}.log', 
            encoding='utf-8'
        ),
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger("AutomatedFyersServer")

# Socket.IO setup
sio = socketio.Server(cors_allowed_origins='*', async_mode='eventlet')
app = socketio.WSGIApp(sio)

# Configuration - Updated for correct V3 API endpoints
client_id = "150HUKJSWG-100"
secret_key = "18YYNXCAS7"
# redirect_uri = "http://localhost:5000/auth/fyers/callback"
# redirect_uri = "https://127.0.0.1:5000/auth/fyers/callback"
redirect_uri = "https://raghavjaiswal709.github.io/DAKSphere_redirect/"

response_type = "code"
grant_type = "authorization_code"

# API Endpoints - Using correct T1 endpoints
BASE_URL_V3 = "https://api-t1.fyers.in/api/v3"
AUTH_URL = f"{BASE_URL_V3}/generate-authcode"
TOKEN_URL = f"{BASE_URL_V3}/validate-authcode"

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
        logger.info("Starting automated authentication process...")
        
        # Generate auth URL and open browser
        auth_url = self.generate_auth_url()
        logger.info(f"Opening browser with auth URL: {auth_url}")
        
        try:
            webbrowser.open(auth_url)
            logger.info("Browser opened successfully")
        except Exception as e:
            logger.error(f"Failed to open browser: {e}")
            logger.info(f"Please manually open: {auth_url}")
        
        # Poll for auth completion
        start_time = time.time()
        while not auth_completed.is_set():
            if time.time() - start_time > self.max_wait_time:
                logger.error("Authentication timeout. Please try again.")
                return None
                
            if self.check_auth_file():
                logger.info("Authentication completed!")
                return self.load_auth_data()
                
            time.sleep(self.polling_interval)
            logger.debug("Waiting for authentication...")
            
        return None
    
    def generate_auth_url(self):
        """Generate Fyers auth URL using correct V3 endpoint"""
        try:
            # Use api-t1.fyers.in for V3 API
            encoded_redirect_uri = quote_plus(redirect_uri)
            state = "None"  # Standard state value for Fyers API
            
            auth_url = f"{AUTH_URL}?client_id={client_id}&redirect_uri={encoded_redirect_uri}&response_type={response_type}&state={state}"
            
            logger.info(f"Generated auth URL: {auth_url}")
            return auth_url
            
        except Exception as e:
            logger.error(f"Error generating auth URL: {e}")
            raise
    
    def check_auth_file(self):
        """Check if auth file exists and is recent"""
        try:
            if not os.path.exists(self.auth_file_path):
                return False
                
            # Check if file is recent (within last 5 minutes)
            file_age = time.time() - os.path.getmtime(self.auth_file_path)
            if file_age > 300:  # 5 minutes
                logger.debug("Auth file is too old")
                return False
                
            with open(self.auth_file_path, 'r') as f:
                auth_data = json.load(f)
                is_valid = ('access_token' in auth_data and 
                           auth_data.get('service') == 'fyers_data' and
                           auth_data.get('timestamp'))
                
                if is_valid:
                    logger.debug("Valid auth file found")
                return is_valid
                
        except Exception as e:
            logger.error(f"Error checking auth file: {e}")
            return False
    
    def load_auth_data(self):
        """Load authentication data from file"""
        try:
            with open(self.auth_file_path, 'r') as f:
                auth_data = json.load(f)
                logger.info("Loaded authentication data from file")
                return auth_data
        except Exception as e:
            logger.error(f"Error loading auth data: {e}")
            return None

# WebSocket event handlers
@sio.event
def connect(sid, environ):
    logger.info(f"Client connected: {sid}")
    clients[sid] = {
        'subscriptions': set(),
        'connected_at': time.time(),
        'last_ping': time.time()
    }
    
    # Send connection confirmation
    sio.emit('connected', {
        'status': 'connected',
        'server_time': time.time(),
        'fyers_status': 'connected' if fyers else 'disconnected'
    }, room=sid)

@sio.event
def disconnect(sid):
    logger.info(f"Client disconnected: {sid}")
    if sid in clients:
        # Clean up subscriptions
        for symbol in clients[sid]['subscriptions']:
            if symbol in symbol_to_clients:
                symbol_to_clients[symbol].discard(sid)
                # If no more clients for this symbol, unsubscribe from Fyers
                if not symbol_to_clients[symbol]:
                    del symbol_to_clients[symbol]
                    if fyers and hasattr(fyers, 'unsubscribe'):
                        try:
                            fyers.unsubscribe(symbol=[symbol])
                            logger.debug(f"Auto-unsubscribed from {symbol}")
                        except Exception as e:
                            logger.error(f"Failed to auto-unsubscribe from {symbol}: {e}")
        
        del clients[sid]

@sio.event
def ping(sid, data):
    """Handle ping requests from clients"""
    if sid in clients:
        clients[sid]['last_ping'] = time.time()
        sio.emit('pong', {
            'server_time': time.time(),
            'client_time': data.get('timestamp', time.time())
        }, room=sid)

@sio.event
def subscribe(sid, data):
    """Handle subscription requests from clients"""
    if sid not in clients:
        logger.warning(f"Unknown client {sid} trying to subscribe")
        sio.emit('error', {'message': 'Client not registered'}, room=sid)
        return
    
    symbols = data.get('symbols', [])
    if not isinstance(symbols, list):
        symbols = [symbols]
    
    logger.info(f"Client {sid} subscribing to {len(symbols)} symbols: {symbols}")
    
    subscribed_symbols = []
    failed_symbols = []
    
    for symbol in symbols:
        try:
            if symbol not in symbol_to_clients:
                symbol_to_clients[symbol] = set()
            
            symbol_to_clients[symbol].add(sid)
            clients[sid]['subscriptions'].add(symbol)
            
            # Subscribe to Fyers WebSocket if available and not already subscribed
            if fyers and hasattr(fyers, 'subscribe'):
                if len(symbol_to_clients[symbol]) == 1:  # First subscriber for this symbol
                    fyers.subscribe(symbol=[symbol], data_type="SymbolUpdate")
                    logger.debug(f"Subscribed to Fyers symbol: {symbol}")
                
            subscribed_symbols.append(symbol)
            
        except Exception as e:
            logger.error(f"Failed to subscribe to {symbol}: {e}")
            failed_symbols.append(symbol)
    
    # Send confirmation
    sio.emit('subscription_response', {
        'success': True,
        'subscribed': subscribed_symbols,
        'failed': failed_symbols,
        'total_subscriptions': len(clients[sid]['subscriptions'])
    }, room=sid)

@sio.event
def unsubscribe(sid, data):
    """Handle unsubscription requests from clients"""
    if sid not in clients:
        return
    
    symbols = data.get('symbols', [])
    if not isinstance(symbols, list):
        symbols = [symbols]
    
    logger.info(f"Client {sid} unsubscribing from {len(symbols)} symbols")
    
    unsubscribed_symbols = []
    
    for symbol in symbols:
        try:
            if symbol in symbol_to_clients:
                symbol_to_clients[symbol].discard(sid)
                
                # If no more clients for this symbol, unsubscribe from Fyers
                if not symbol_to_clients[symbol]:
                    del symbol_to_clients[symbol]
                    
                    if fyers and hasattr(fyers, 'unsubscribe'):
                        fyers.unsubscribe(symbol=[symbol])
                        logger.debug(f"Unsubscribed from Fyers symbol: {symbol}")
            
            clients[sid]['subscriptions'].discard(symbol)
            unsubscribed_symbols.append(symbol)
            
        except Exception as e:
            logger.error(f"Failed to unsubscribe from {symbol}: {e}")
    
    # Send confirmation
    sio.emit('unsubscription_response', {
        'success': True,
        'unsubscribed': unsubscribed_symbols,
        'remaining_subscriptions': len(clients[sid]['subscriptions'])
    }, room=sid)

@sio.event
def auth_token_ready(sid, data):
    """Handle auth token ready event from web interface"""
    global access_token, fyers_client, fyers
    
    logger.info("Received auth token from web interface")
    access_token = data.get('access_token')
    auth_code = data.get('auth_code')
    
    if access_token:
        try:
            # Initialize Fyers client
            token_only = access_token.replace(f"{client_id}:", "") if access_token.startswith(client_id) else access_token
            
            fyers_client = fyersModel.FyersModel(
                client_id=client_id,
                token=token_only,
                log_path=""
            )
            
            # Test the client
            profile_response = fyers_client.get_profile()
            if profile_response.get('s') == 'ok':
                logger.info("Fyers client initialized and verified successfully")
            else:
                logger.warning(f"Fyers client warning: {profile_response}")
            
            # Initialize WebSocket
            full_access_token = access_token if access_token.startswith(client_id) else f"{client_id}:{access_token}"
            
            fyers = data_ws.FyersDataSocket(
                access_token=full_access_token,
                log_path="",
                litemode=False,
                write_to_file=False,
                reconnect=True,
                on_connect=onopen,
                on_close=onclose,
                on_error=onerror,
                on_message=onmessage
            )
            
            logger.info("Fyers client and WebSocket initialized successfully")
            auth_completed.set()
            
            # Notify all connected clients
            sio.emit('fyers_authenticated', {
                'status': 'authenticated',
                'timestamp': time.time()
            })
            
        except Exception as e:
            logger.error(f"Error initializing Fyers: {e}")
            sio.emit('fyers_auth_error', {
                'error': str(e),
                'timestamp': time.time()
            })

def onmessage(message):
    """Handle incoming Fyers WebSocket messages"""
    try:
        if isinstance(message, dict) and message.get('type') == 'sub':
            logger.debug(f"Subscription confirmation: {message}")
            return
        
        if isinstance(message, dict) and 'symbol' in message:
            symbol = message['symbol']
            
            # Add timestamp if not present
            current_time = int(time.time())
            ist_time = datetime.datetime.fromtimestamp(current_time, INDIA_TZ)
            
            # Create standardized market data
            simplified_data = {
                'symbol': symbol,
                'ltp': float(message.get('ltp', 0)),
                'change': float(message.get('ch', 0)),
                'changePercent': float(message.get('chp', 0)),
                'volume': int(message.get('vol_traded_today', 0)),
                'open': float(message.get('open_price', 0)),
                'high': float(message.get('high_price', 0)),
                'low': float(message.get('low_price', 0)),
                'close': float(message.get('prev_close_price', 0)),
                'bid': float(message.get('bid_price', 0)),
                'ask': float(message.get('ask_price', 0)),
                'timestamp': message.get('last_traded_time', current_time),
                'formatted_time': ist_time.strftime("%H:%M:%S"),
                'server_time': current_time
            }
            
            # Store historical data
            if symbol not in historical_data:
                historical_data[symbol] = deque(maxlen=MAX_HISTORY_POINTS)
            
            historical_data[symbol].append({
                'timestamp': current_time,
                'ltp': simplified_data['ltp'],
                'volume': simplified_data['volume'],
                'high': simplified_data['high'],
                'low': simplified_data['low']
            })
            
            # Send data to subscribed clients
            if symbol in symbol_to_clients:
                disconnected_clients = set()
                
                for sid in list(symbol_to_clients[symbol]):
                    try:
                        sio.emit('marketData', simplified_data, room=sid)
                    except Exception as e:
                        logger.error(f"Error sending data to client {sid}: {e}")
                        disconnected_clients.add(sid)
                
                # Clean up disconnected clients
                for sid in disconnected_clients:
                    symbol_to_clients[symbol].discard(sid)
                    if sid in clients:
                        del clients[sid]
                
                # Remove symbol if no clients left
                if not symbol_to_clients[symbol]:
                    del symbol_to_clients[symbol]
                    
    except Exception as e:
        logger.error(f"Error processing message: {e}")
        logger.debug(f"Problematic message: {message}")

def onopen():
    logger.info("Fyers WebSocket connected successfully")
    sio.emit('fyersConnected', {
        'status': 'connected',
        'timestamp': time.time()
    })

def onerror(error):
    logger.error(f"Fyers WebSocket Error: {error}")
    sio.emit('fyersError', {
        'message': str(error),
        'timestamp': time.time()
    })

def onclose(message):
    logger.info(f"Fyers WebSocket Connection closed: {message}")
    sio.emit('fyersDisconnected', {
        'message': str(message),
        'timestamp': time.time()
    })

def cleanup_disconnected_clients():
    """Periodic cleanup of disconnected clients"""
    current_time = time.time()
    disconnected_clients = []
    
    for sid, client_data in clients.items():
        # Consider client disconnected if no ping for 60 seconds
        if current_time - client_data['last_ping'] > 60:
            disconnected_clients.append(sid)
    
    for sid in disconnected_clients:
        logger.info(f"Cleaning up inactive client: {sid}")
        disconnect(sid)

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
            logger.error("Authentication failed or timed out")
            return
            
        access_token = auth_data.get('access_token')
        if not access_token:
            logger.error("No access token received")
            return
            
        # Initialize Fyers client
        token_only = access_token.replace(f"{client_id}:", "") if access_token.startswith(client_id) else access_token
        
        fyers_client = fyersModel.FyersModel(
            client_id=client_id,
            token=token_only,
            log_path=""
        )
        
        # Verify client works
        try:
            profile = fyers_client.get_profile()
            if profile.get('s') == 'ok':
                logger.info("Fyers API client verified successfully")
            else:
                logger.warning(f"Fyers API client verification warning: {profile}")
        except Exception as e:
            logger.error(f"Fyers API client verification failed: {e}")
        
        # Initialize WebSocket
        full_access_token = access_token if access_token.startswith(client_id) else f"{client_id}:{access_token}"
        
        fyers = data_ws.FyersDataSocket(
            access_token=full_access_token,
            log_path="",
            litemode=False,
            write_to_file=False,
            reconnect=True,
            on_connect=onopen,
            on_close=onclose,
            on_error=onerror,
            on_message=onmessage
        )
        
        logger.info("Starting Fyers WebSocket connection...")
        fyers.connect()
        
        # Start periodic cleanup
        def periodic_cleanup():
            while running:
                time.sleep(30)  # Clean up every 30 seconds
                try:
                    cleanup_disconnected_clients()
                except Exception as e:
                    logger.error(f"Error in periodic cleanup: {e}")
        
        cleanup_thread = threading.Thread(target=periodic_cleanup, daemon=True)
        cleanup_thread.start()
        
        logger.info("Starting Socket.IO server on port 5001...")
        eventlet.wsgi.server(eventlet.listen(('0.0.0.0', 5001)), app)
        
    except Exception as e:
        logger.error(f"Error in main process: {e}")
        import traceback
        traceback.print_exc()

def main():
    global running
    
    logger.info("=" * 60)
    logger.info("Starting Automated Fyers Data Server")
    logger.info("Authentication will be handled automatically through web interface")
    logger.info(f"Server will start on port 5001")
    logger.info(f"Redirect URI: {redirect_uri}")
    logger.info("=" * 60)
    
    try:
        # Start main process in eventlet
        eventlet.spawn(main_process)
        
        # Keep main thread alive
        while running:
            time.sleep(1)
            
    except KeyboardInterrupt:
        logger.info("Shutdown requested by user")
        running = False
    except Exception as e:
        logger.error(f"Fatal error in main: {e}")
        import traceback
        traceback.print_exc()
        running = False

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        logger.info("Shutting down gracefully...")
        running = False
    except Exception as e:
        logger.error(f"Fatal error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        logger.info("Server shutdown complete")
