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
import os
from collections import deque
from fyers_apiv3 import fyersModel
from fyers_apiv3.FyersWebsocket import data_ws
import pandas as pd

# Enhanced logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(f'fyers_5010_{datetime.datetime.now().strftime("%Y%m%d")}.log', encoding='utf-8'),
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger("Fyers5010")

# Socket.IO setup
sio = socketio.Server(cors_allowed_origins='*', async_mode='eventlet')
app = socketio.WSGIApp(sio)

# Configuration
client_id = "150HUKJSWG-100"
INDIA_TZ = pytz.timezone('Asia/Kolkata')
MAX_HISTORY_POINTS = 10000
MAX_COMPANIES = 6

# Global variables
clients = {}
symbol_to_clients = {}
active_subscriptions = set()
historical_data = {}
real_time_data = {}
available_symbols = []
fyers_client = None
fyers_ws = None
auth_initialized = False
running = True

def get_trading_hours():
    """Get market trading hours in IST."""
    now = datetime.datetime.now(INDIA_TZ)
    start_time = now.replace(hour=9, minute=15, second=0, microsecond=0)
    end_time = now.replace(hour=15, minute=30, second=0, microsecond=0)
    return start_time, end_time

def is_trading_hours():
    """Check if current time is within trading hours."""
    now = datetime.datetime.now(INDIA_TZ)
    start_time, end_time = get_trading_hours()
    if now.weekday() >= 5:
        return False
    return start_time <= now <= end_time

def extract_jwt_token(full_token):
    """Extract JWT token from full token string."""
    if ':' in full_token:
        # Format: "client_id:jwt_token" - extract the JWT part
        return full_token.split(':', 1)[1]
    else:
        # Already just the JWT token
        return full_token

def load_available_symbols():
    """Load available symbols."""
    global available_symbols
    try:
        # Try to load from CSV, otherwise use dynamic mode
        csv_path = 'data/watchlists/watchlist_A_2025-02-16.csv'
        if os.path.exists(csv_path):
            df = pd.read_csv(csv_path)
            available_symbols = []
            for _, row in df.iterrows():
                symbol_data = {
                    'symbol': f"{row.get('Exchange', 'NSE')}:{row['company_code']}-{row.get('marker', 'EQ')}",
                    'company_code': row['company_code'],
                    'name': row.get('name', row['company_code']),
                    'exchange': row.get('Exchange', 'NSE'),
                    'marker': row.get('marker', 'EQ')
                }
                available_symbols.append(symbol_data)
            logger.info(f"Loaded {len(available_symbols)} symbols from CSV")
        else:
            available_symbols = []
            logger.info("Operating in dynamic mode")
        return True
    except Exception as e:
        logger.error(f"Error loading symbols: {e}")
        available_symbols = []
        return True

def add_symbol_dynamically(company_code, exchange='NSE', marker='EQ'):
    """Add symbol dynamically."""
    symbol = f"{exchange}:{company_code}-{marker}"
    existing = next((s for s in available_symbols if s['symbol'] == symbol), None)
    if not existing:
        symbol_data = {
            'symbol': symbol,
            'company_code': company_code,
            'name': company_code,
            'exchange': exchange,
            'marker': marker
        }
        available_symbols.append(symbol_data)
        logger.info(f"Added symbol dynamically: {symbol}")
        return symbol_data
    return existing

def initialize_fyers():
    """Initialize Fyers client and WebSocket."""
    global fyers_client, fyers_ws, auth_initialized
    
    auth_file_path = os.path.join('data', 'fyers_data_auth.json')
    
    try:
        if not os.path.exists(auth_file_path):
            logger.info("ℹ️ No auth file found")
            return False
        
        with open(auth_file_path, 'r') as f:
            auth_data = json.load(f)
        
        full_access_token = auth_data.get('access_token')
        if not full_access_token:
            logger.error("❌ No access token found")
            return False
        
        # FIXED: Handle different token formats properly
        jwt_token = extract_jwt_token(full_access_token)
        logger.info(f"🔍 JWT token: {jwt_token[:30]}...")
        logger.info(f"🔍 Full token: {full_access_token[:30]}...")
        
        # Initialize REST client with JWT token only
        try:
            fyers_client = fyersModel.FyersModel(
                client_id=client_id,
                token=jwt_token,  # Use JWT token only for REST API
                log_path=""
            )
            
            # Test connection
            response = fyers_client.get_profile()
            if response and response.get('s') == 'ok':
                user_data = response.get('data', {})
                user_name = user_data.get('name', 'Unknown')
                logger.info(f"✅ REST API client initialized - User: {user_name}")
            else:
                logger.error(f"❌ REST API test failed: {response}")
                return False
                
        except Exception as e:
            logger.error(f"❌ REST client error: {e}")
            return False
        
        # Initialize WebSocket with full token (client_id:jwt format)
        try:
            # Ensure we have the client_id:jwt format for WebSocket
            ws_token = full_access_token if ':' in full_access_token else f"{client_id}:{jwt_token}"
            
            fyers_ws = data_ws.FyersDataSocket(
                access_token=ws_token,
                log_path="",
                litemode=False,
                write_to_file=False,
                reconnect=True,
                on_connect=on_ws_connect,
                on_close=on_ws_close,
                on_error=on_ws_error,
                on_message=on_ws_message
            )
            logger.info("✅ WebSocket client initialized")
            
        except Exception as e:
            logger.error(f"❌ WebSocket initialization error: {e}")
            fyers_ws = None
        
        auth_initialized = True
        return True
        
    except Exception as e:
        logger.error(f"❌ Error loading auth: {e}")
        return False

def fetch_historical_data(symbol, date=None):
    """Fetch historical data."""
    if not date:
        date = datetime.datetime.now(INDIA_TZ).strftime('%Y-%m-%d')
    
    try:
        if not fyers_client or not auth_initialized:
            return []
        
        date_obj = datetime.datetime.strptime(date, '%Y-%m-%d')
        date_obj = INDIA_TZ.localize(date_obj)
        
        market_open = date_obj.replace(hour=9, minute=15, second=0, microsecond=0)
        market_close = date_obj.replace(hour=15, minute=30, second=0, microsecond=0)
        
        now = datetime.datetime.now(INDIA_TZ)
        end_time = min(now, market_close) if date == now.strftime('%Y-%m-%d') else market_close
        
        from_date = market_open.strftime('%Y-%m-%d %H:%M:%S')
        to_date = end_time.strftime('%Y-%m-%d %H:%M:%S')
        
        data_args = {
            "symbol": symbol,
            "resolution": "1",
            "date_format": "1",
            "range_from": from_date,
            "range_to": to_date,
            "cont_flag": "1"
        }
        
        response = fyers_client.history(data_args)
        
        if response and response.get('s') == 'ok' and 'candles' in response:
            result = []
            for candle in response['candles']:
                timestamp, open_price, high_price, low_price, close_price, volume = candle
                
                if timestamp > 10000000000:
                    timestamp = timestamp // 1000
                
                data_point = {
                    'symbol': symbol,
                    'ltp': float(close_price),
                    'open': float(open_price),
                    'high': float(high_price),
                    'low': float(low_price),
                    'close': float(close_price),
                    'volume': int(volume),
                    'timestamp': timestamp
                }
                result.append(data_point)
            
            logger.info(f"✅ Fetched {len(result)} points for {symbol}")
            return result
        else:
            error_msg = response.get('message', 'Unknown error') if response else 'No response'
            error_code = response.get('code') if response else 'No code'
            logger.error(f"❌ API error for {symbol}: Code={error_code}, Message={error_msg}")
            return []
        
    except Exception as e:
        logger.error(f"❌ Error fetching {symbol}: {e}")
        return []

# WebSocket Handlers
def on_ws_connect():
    """WebSocket connected."""
    logger.info("✅ WebSocket connected")
    sio.emit('fyersConnected', {'status': 'connected'})
    
    # Subscribe to active symbols
    if active_subscriptions and fyers_ws:
        try:
            symbol_list = list(active_subscriptions)
            fyers_ws.subscribe(symbol_list)
            logger.info(f"📡 WebSocket subscribed to {len(symbol_list)} symbols")
        except Exception as e:
            logger.error(f"❌ WebSocket subscription error: {e}")

def on_ws_close(message):
    """WebSocket closed."""
    logger.info(f"❌ WebSocket closed: {message}")
    sio.emit('fyersDisconnected', {'message': str(message)})

def on_ws_error(error):
    """WebSocket error."""
    logger.error(f"❌ WebSocket error: {error}")
    sio.emit('fyersError', {'message': str(error)})

def on_ws_message(message):
    """WebSocket message received."""
    try:
        if isinstance(message, dict) and 'symbol' in message:
            symbol = message['symbol']
            
            if symbol in active_subscriptions:
                current_time = int(time.time())
                
                market_data = {
                    'symbol': symbol,
                    'ltp': float(message.get('ltp', 0)),
                    'change': float(message.get('ch', 0)),
                    'changePercent': float(message.get('chp', 0)),
                    'volume': int(message.get('vol_traded_today', 0)),
                    'open': float(message.get('open_price', 0)),
                    'high': float(message.get('high_price', 0)),
                    'low': float(message.get('low_price', 0)),
                    'close': float(message.get('prev_close_price', 0)),
                    'timestamp': current_time
                }
                
                # Store real-time data
                real_time_data[symbol] = market_data
                
                # Store in historical data
                if symbol not in historical_data:
                    historical_data[symbol] = deque(maxlen=MAX_HISTORY_POINTS)
                historical_data[symbol].append(market_data)
                
                # Send to subscribed clients
                if symbol in symbol_to_clients:
                    for sid in symbol_to_clients[symbol]:
                        try:
                            sio.emit('marketData', market_data, room=sid)
                        except Exception as e:
                            logger.error(f"Error sending data to {sid}: {e}")
                
    except Exception as e:
        logger.error(f"❌ Message processing error: {e}")

# Socket.IO Event Handlers
@sio.event
def connect(sid, environ):
    """Client connected."""
    logger.info(f"[5010] Client connected: {sid}")
    clients[sid] = {
        'subscriptions': set(),
        'connected_at': datetime.datetime.now(INDIA_TZ),
        'last_activity': datetime.datetime.now(INDIA_TZ)
    }
    
    sio.emit('availableSymbols', {
        'symbols': available_symbols,
        'maxCompanies': MAX_COMPANIES,
        'tradingHours': {
            'isActive': is_trading_hours(),
            'start': get_trading_hours()[0].isoformat(),
            'end': get_trading_hours()[1].isoformat()
        },
        'authStatus': auth_initialized
    }, room=sid)

@sio.event
def disconnect(sid):
    """Client disconnected."""
    logger.info(f"[5010] Client disconnected: {sid}")
    if sid in clients:
        for symbol in clients[sid]['subscriptions']:
            if symbol in symbol_to_clients:
                symbol_to_clients[symbol].discard(sid)
                if not symbol_to_clients[symbol]:
                    active_subscriptions.discard(symbol)
        del clients[sid]

@sio.event
def subscribe_companies(sid, data):
    """Subscribe to companies."""
    try:
        company_codes = data.get('companyCodes', [])
        
        if not isinstance(company_codes, list) or len(company_codes) == 0:
            sio.emit('error', {'message': 'Invalid company codes'}, room=sid)
            return
        
        if len(company_codes) > MAX_COMPANIES:
            sio.emit('error', {'message': f'Maximum {MAX_COMPANIES} companies allowed'}, room=sid)
            return
        
        # Clear existing subscriptions
        if sid in clients:
            for symbol in clients[sid]['subscriptions']:
                if symbol in symbol_to_clients:
                    symbol_to_clients[symbol].discard(sid)
                    if not symbol_to_clients[symbol]:
                        active_subscriptions.discard(symbol)
            clients[sid]['subscriptions'].clear()
        
        # Process new subscriptions
        requested_symbols = []
        for code in company_codes:
            code = str(code).strip().upper()
            
            # Find or create symbol
            symbol_data = next((s for s in available_symbols if s['company_code'] == code), None)
            if not symbol_data:
                symbol_data = add_symbol_dynamically(code)
            
            symbol = symbol_data['symbol']
            requested_symbols.append(symbol)
            
            # Add to client subscriptions
            if sid not in clients:
                clients[sid] = {'subscriptions': set(), 'connected_at': datetime.datetime.now(INDIA_TZ), 'last_activity': datetime.datetime.now(INDIA_TZ)}
            
            clients[sid]['subscriptions'].add(symbol)
            
            if symbol not in symbol_to_clients:
                symbol_to_clients[symbol] = set()
            symbol_to_clients[symbol].add(sid)
            
            active_subscriptions.add(symbol)
        
        # Send confirmation
        sio.emit('subscriptionConfirm', {
            'success': True,
            'symbols': requested_symbols,
            'count': len(requested_symbols)
        }, room=sid)
        
        # Subscribe to WebSocket if available
        if fyers_ws and requested_symbols:
            try:
                fyers_ws.subscribe(requested_symbols)
                logger.info(f"📡 WebSocket subscribed to: {requested_symbols}")
            except Exception as e:
                logger.error(f"❌ WebSocket subscription error: {e}")
        
        # Fetch historical data in background
        def fetch_all_data():
            for symbol in requested_symbols:
                try:
                    hist_data = fetch_historical_data(symbol)
                    if hist_data:
                        if symbol not in historical_data:
                            historical_data[symbol] = deque(maxlen=MAX_HISTORY_POINTS)
                        
                        for point in hist_data:
                            historical_data[symbol].append(point)
                        
                        sio.emit('historicalData', {
                            'symbol': symbol,
                            'data': hist_data
                        }, room=sid)
                    else:
                        sio.emit('historicalData', {
                            'symbol': symbol,
                            'data': []
                        }, room=sid)
                    
                    time.sleep(0.2)  # Small delay between requests
                except Exception as e:
                    logger.error(f"Error fetching data for {symbol}: {e}")
        
        threading.Thread(target=fetch_all_data, daemon=True).start()
        
    except Exception as e:
        logger.error(f"❌ Subscribe error: {e}")
        sio.emit('error', {'message': str(e)}, room=sid)

@sio.event
def unsubscribe_all(sid, data):
    """Unsubscribe from all."""
    try:
        if sid in clients:
            for symbol in clients[sid]['subscriptions']:
                if symbol in symbol_to_clients:
                    symbol_to_clients[symbol].discard(sid)
                    if not symbol_to_clients[symbol]:
                        active_subscriptions.discard(symbol)
            clients[sid]['subscriptions'].clear()
        
        sio.emit('subscriptionConfirm', {
            'success': True,
            'symbols': [],
            'count': 0
        }, room=sid)
        
    except Exception as e:
        logger.error(f"❌ Unsubscribe error: {e}")

def auth_watcher():
    """Watch auth file."""
    global running
    auth_file_path = os.path.join('data', 'fyers_data_auth.json')
    last_modified = 0
    
    while running:
        try:
            if os.path.exists(auth_file_path):
                current_modified = os.path.getmtime(auth_file_path)
                if current_modified > last_modified or not auth_initialized:
                    if not auth_initialized:  # Only reinitialize if not already successful
                        logger.info("🔄 Auth file updated, reinitializing...")
                        if initialize_fyers() and fyers_ws:
                            try:
                                ws_thread = threading.Thread(target=lambda: fyers_ws.connect(), daemon=True)
                                ws_thread.start()
                                logger.info("✅ WebSocket connection started")
                            except Exception as e:
                                logger.error(f"❌ WebSocket start error: {e}")
                    last_modified = current_modified
            time.sleep(5)
        except Exception as e:
            logger.error(f"❌ Auth watcher error: {e}")
            time.sleep(10)

def main():
    """Main function."""
    global running
    
    logger.info("🚀 Starting Fyers Service 5010 - Advanced Real-time Service (Fixed Token)")
    
    try:
        # Create directories
        os.makedirs('data', exist_ok=True)
        
        # Load symbols
        load_available_symbols()
        
        # Initialize Fyers
        if initialize_fyers():
            logger.info("✅ Initial authentication successful")
            # Start WebSocket
            if fyers_ws:
                ws_thread = threading.Thread(target=lambda: fyers_ws.connect(), daemon=True)
                ws_thread.start()
                logger.info("✅ WebSocket connection started")
        else:
            logger.info("⚠️ Initial authentication failed, will retry when auth file updates")
        
        # Start auth watcher
        auth_thread = threading.Thread(target=auth_watcher, daemon=True)
        auth_thread.start()
        
        logger.info("✅ Service 5010 started successfully on port 5010")
        logger.info("🔑 Using JWT token for REST API, full token for WebSocket")
        
        # Start server
        eventlet.wsgi.server(eventlet.listen(('0.0.0.0', 5010)), app)
        
    except KeyboardInterrupt:
        logger.info("🛑 Shutdown requested")
        running = False
    except Exception as e:
        logger.error(f"❌ Fatal error: {e}")
        running = False

if __name__ == "__main__":
    main()
