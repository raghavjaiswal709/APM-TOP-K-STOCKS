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
import pandas as pd

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
            f'unified_fyers_{datetime.datetime.now().strftime("%Y%m%d")}.log', 
            encoding='utf-8'
        ),
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger("UnifiedFyersServer")

# ============= PORT 5001 SOCKET.IO SETUP =============
sio_5001 = socketio.Server(cors_allowed_origins='*', async_mode='eventlet')
app_5001 = socketio.WSGIApp(sio_5001)

# ============= PORT 5010 SOCKET.IO SETUP =============
sio_5010 = socketio.Server(
    cors_allowed_origins='*', 
    async_mode='eventlet',
    logger=False,
    engineio_logger=False
)
app_5010 = socketio.WSGIApp(sio_5010)

# Configuration
client_id = "150HUKJSWG-100"
secret_key = "18YYNXCAS7"
redirect_uri = "https://raghavjaiswal709.github.io/DAKSphere_redirect/"
response_type = "code"
grant_type = "authorization_code"

# API Endpoints
BASE_URL_V3 = "https://api-t2.fyers.in/api/v3"
AUTH_URL = f"{BASE_URL_V3}/generate-authcode"
TOKEN_URL = f"{BASE_URL_V3}/validate-authcode"

# ============= SHARED GLOBAL VARIABLES =============
# Port 5001 variables
clients_5001 = {}
symbol_to_clients_5001 = {}
historical_data_5001 = {}
ohlc_data_5001 = {}

# Port 5010 variables
clients_5010 = {}
symbol_to_clients_5010 = {}
active_subscriptions_5010 = set()
historical_data_5010 = {}
ohlc_data_5010 = {}
real_time_data_5010 = {}
available_symbols = []
last_tick = {}

# Shared variables
running = True
MAX_HISTORY_POINTS = 10000
MAX_COMPANIES = 6
INDIA_TZ = pytz.timezone('Asia/Kolkata')
fyers = None
fyers_client = None
access_token = None
auth_initialized = False
last_connection_test = 0

# FIXED: Add rate limiting and failed requests tracking
api_call_timestamps = deque(maxlen=100)  # Track last 100 API calls
failed_symbols = {}  # Track failed symbols with cooldown
RATE_LIMIT_PER_SECOND = 2  # Max 2 API calls per second
FAILED_SYMBOL_COOLDOWN = 300  # 5 minutes cooldown for failed symbols

MONITORED_FIELDS = [
    'ltp', 'vol_traded_today', 'last_traded_time', 'bid_size', 'ask_size',
    'bid_price', 'ask_price', 'low_price', 'high_price', 'open_price', 'prev_close_price'
]

# ============= SHARED UTILITY FUNCTIONS =============
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
    if now.weekday() >= 5:  # FIXED: Removed HTML entities
        return False
    return start_time <= now <= end_time  # FIXED: Removed HTML entities

def can_make_api_call():
    """Check if we can make an API call based on rate limiting."""
    current_time = time.time()
    
    # Remove old timestamps (older than 1 second)
    while api_call_timestamps and current_time - api_call_timestamps[0] > 1:
        api_call_timestamps.popleft()
    
    # Check if we're under the rate limit
    if len(api_call_timestamps) >= RATE_LIMIT_PER_SECOND:
        return False
    
    return True

def record_api_call():
    """Record an API call timestamp."""
    api_call_timestamps.append(time.time())

def is_symbol_in_cooldown(symbol):
    """Check if a symbol is in cooldown due to recent failures."""
    if symbol not in failed_symbols:
        return False
    
    current_time = time.time()
    if current_time - failed_symbols[symbol] > FAILED_SYMBOL_COOLDOWN:
        # Remove from failed symbols if cooldown is over
        del failed_symbols[symbol]
        return False
    
    return True

def record_symbol_failure(symbol):
    """Record a symbol failure."""
    failed_symbols[symbol] = time.time()
    logger.warning(f"🚫 Symbol {symbol} added to cooldown for {FAILED_SYMBOL_COOLDOWN} seconds")

def safe_symbol_parse(symbol):
    """Safely parse symbol string to extract exchange and company code."""
    try:
        if ':' not in symbol:
            logger.warning(f"Invalid symbol format (no colon): {symbol}")
            return None, None
        
        parts = symbol.split(':', 1)
        if len(parts) != 2:
            logger.warning(f"Invalid symbol format: {symbol}")
            return None, None
            
        exchange = parts[0]
        code_part = parts[1]
        
        if '-' not in code_part:
            logger.warning(f"Invalid code part (no hyphen): {code_part}")
            return exchange, code_part
        
        company_code = code_part.split('-')[0]
        return exchange, company_code
        
    except Exception as e:
        logger.error(f"Error parsing symbol {symbol}: {e}")
        return None, None

def create_symbol_from_code(company_code, exchange='NSE', marker='EQ'):
    """Create a full Fyers symbol from company code."""
    return f"{exchange}:{company_code}-{marker}"

def add_symbol_to_available(company_code, exchange='NSE', marker='EQ', name=None):
    """Dynamically add a symbol to available symbols if not exists."""
    global available_symbols
    
    symbol = create_symbol_from_code(company_code, exchange, marker)
    
    # Check if symbol already exists
    existing = next((s for s in available_symbols if s['symbol'] == symbol), None)
    if not existing:
        symbol_data = {
            'symbol': symbol,
            'company_code': company_code,
            'name': name or company_code,
            'exchange': exchange,
            'marker': marker
        }
        available_symbols.append(symbol_data)
        logger.info(f"Dynamically added symbol: {symbol}")
        return symbol_data
    return existing

def load_available_symbols():
    """Load available symbols from watchlist A - optional, fallback to empty."""
    global available_symbols
    try:
        csv_path = os.path.join(os.path.dirname(__file__), 'data', 'watchlists', 'watchlist_A_2025-02-16.csv')
        
        # Try alternative paths if main path doesn't exist
        if not os.path.exists(csv_path):
            csv_path = 'apps/backend/data/watchlists/watchlist_A_2025-02-16.csv'
        
        if not os.path.exists(csv_path):
            # No hardcoded symbols - completely dynamic
            logger.info("No watchlist file found - operating in dynamic mode")
            available_symbols = []
            return True
        else:
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
        
        logger.info(f"Loaded {len(available_symbols)} available symbols from watchlist")
        return True
        
    except Exception as e:
        logger.error(f"Error loading symbols: {e}")
        available_symbols = []
        logger.info("Operating in fully dynamic mode - no predefined symbols")
        return True

# ============= ENHANCED AUTHENTICATION HANDLER =============
def test_fyers_connection(fyers_client_instance):
    """Test if Fyers client can make API calls successfully."""
    global last_connection_test
    
    try:
        # Avoid testing too frequently
        current_time = time.time()
        if current_time - last_connection_test < 30:  # Test at most every 30 seconds
            return True, "Recent test passed"
        
        logger.info("🧪 Testing Fyers API connection...")
        
        # Test with a simple profile call
        response = fyers_client_instance.get_profile()
        last_connection_test = current_time
        
        if response and response.get('s') == 'ok':
            logger.info("✅ Fyers API connection test successful")
            user_data = response.get('data', {})
            user_name = user_data.get('name', 'Unknown')
            user_id = user_data.get('fy_id', 'Unknown')
            logger.info(f"👤 Authenticated as: {user_name} (ID: {user_id})")
            return True, "Connection successful"
        else:
            logger.error(f"❌ Fyers API test failed: {response}")
            return False, f"API test failed: {response}"
            
    except Exception as e:
        logger.error(f"❌ Fyers connection test error: {e}")
        last_connection_test = current_time
        return False, f"Connection test error: {e}"

def initialize_fyers_from_auth_file():
    """ENHANCED: Better Fyers initialization matching individual code patterns."""
    global fyers, fyers_client, access_token, auth_initialized
    
    auth_file_path = os.path.join('data', 'fyers_data_auth.json')
    
    try:
        if not os.path.exists(auth_file_path):
            logger.info("ℹ️ No auth file found - waiting for UI authentication")
            auth_initialized = False
            return False
        
        logger.info("📂 Reading authentication file...")
        with open(auth_file_path, 'r') as f:
            auth_data = json.load(f)
        
        # Get the raw token
        raw_access_token = auth_data.get('access_token')
        if not raw_access_token:
            logger.error("❌ No access token found in auth file")
            auth_initialized = False
            return False
        
        logger.info(f"🔍 Found access token: {raw_access_token[:20]}...")
        
        # ENHANCED: Match individual code pattern exactly
        # For REST API client, use the token as stored (usually includes client_id)
        try:
            # Try the token as-is first (this is what individual codes do)
            fyers_client = fyersModel.FyersModel(
                client_id=client_id,
                token=raw_access_token,  # Use raw token directly
                log_path=""
            )
            logger.info("✅ Fyers REST API client initialized with raw token")
            
            # Test the connection immediately
            connection_ok, test_message = test_fyers_connection(fyers_client)
            if connection_ok:
                logger.info("✅ Raw token works for REST API")
            else:
                # If raw token fails, try extracting clean token
                logger.info("⚠️ Raw token failed, trying to extract clean token...")
                
                if ':' in raw_access_token:
                    clean_token = raw_access_token.split(':', 1)[1]
                    fyers_client = fyersModel.FyersModel(
                        client_id=client_id,
                        token=clean_token,
                        log_path=""
                    )
                    connection_ok, test_message = test_fyers_connection(fyers_client)
                    if connection_ok:
                        logger.info("✅ Clean token works for REST API")
                    else:
                        logger.error(f"❌ Both token formats failed: {test_message}")
                        fyers_client = None
                        auth_initialized = False
                        return False
                else:
                    logger.error(f"❌ Cannot extract clean token and raw token failed")
                    fyers_client = None
                    auth_initialized = False
                    return False
                
        except Exception as e:
            logger.error(f"❌ Failed to initialize Fyers REST client: {e}")
            auth_initialized = False
            return False
        
        # ENHANCED: Initialize WebSocket with proper token format
        try:
            # For WebSocket, ensure we have client_id:token format
            ws_token = raw_access_token
            if ':' not in ws_token:
                ws_token = f"{client_id}:{raw_access_token}"
            
            fyers = data_ws.FyersDataSocket(
                access_token=ws_token,
                log_path="",
                litemode=False,
                write_to_file=False,
                reconnect=True,
                on_connect=onopen,
                on_close=onclose,
                on_error=onerror,
                on_message=onmessage
            )
            logger.info("✅ Fyers WebSocket client initialized")
        except Exception as e:
            logger.error(f"❌ Failed to initialize WebSocket: {e}")
            fyers = None
        
        access_token = raw_access_token
        auth_initialized = True
        logger.info("🎉 Fyers initialization complete - Both REST API and WebSocket ready")
        
        return True
        
    except json.JSONDecodeError as e:
        logger.error(f"❌ Invalid JSON in auth file: {e}")
        auth_initialized = False
        return False
    except Exception as e:
        logger.error(f"❌ Error loading auth data: {e}")
        import traceback
        traceback.print_exc()
        auth_initialized = False
        return False

def fetch_historical_intraday_data(symbol, date=None):
    """ENHANCED: Robust historical data fetching with rate limiting and error handling."""
    if not date:
        date = datetime.datetime.now(INDIA_TZ).strftime('%Y-%m-%d')
    
    try:
        # Check if symbol is in cooldown
        if is_symbol_in_cooldown(symbol):
            logger.debug(f"🚫 Symbol {symbol} is in cooldown, skipping request")
            return []
        
        # Check authentication
        if not fyers_client or not auth_initialized:
            logger.error(f"❌ Fyers client not initialized for {symbol}")
            return []
        
        # Check rate limiting
        if not can_make_api_call():
            logger.debug(f"⏳ Rate limit reached, waiting before fetching {symbol}")
            time.sleep(0.5)  # Brief wait
            if not can_make_api_call():
                logger.warning(f"⚠️ Still rate limited, skipping {symbol}")
                return []
        
        # Record this API call
        record_api_call()
        
        date_obj = datetime.datetime.strptime(date, '%Y-%m-%d')
        date_obj = INDIA_TZ.localize(date_obj)
        
        market_open = date_obj.replace(hour=9, minute=15, second=0, microsecond=0)
        market_close = date_obj.replace(hour=15, minute=30, second=0, microsecond=0)
        
        now = datetime.datetime.now(INDIA_TZ)
        if date == now.strftime('%Y-%m-%d') and now < market_open:
            logger.debug(f"📅 Market not yet open for {date}")
            return []
        
        end_time = min(now, market_close) if date == now.strftime('%Y-%m-%d') else market_close
        
        from_date = market_open.strftime('%Y-%m-%d %H:%M:%S')
        to_date = end_time.strftime('%Y-%m-%d %H:%M:%S')
        
        logger.info(f"📊 Fetching historical data for {symbol}")
        
        # ENHANCED: Use exact same format as individual working codes
        data_args = {
            "symbol": symbol,
            "resolution": "1",
            "date_format": "1",
            "range_from": from_date,
            "range_to": to_date,
            "cont_flag": "1"
        }
        
        logger.debug(f"🔍 API request for {symbol}: {data_args}")
        
        # Make the API call with timeout
        try:
            response = fyers_client.history(data_args)
            
            if not response:
                logger.error(f"❌ No response from API for {symbol}")
                record_symbol_failure(symbol)
                return []
            
            logger.debug(f"📡 API Response for {symbol}: status={response.get('s')}, code={response.get('code')}")
            
            if response.get('s') == 'ok' and 'candles' in response:
                candles = response['candles']
                logger.info(f"✅ Received {len(candles)} candles for {symbol}")
                
                result = []
                
                for candle in candles:
                    try:
                        timestamp, open_price, high_price, low_price, close_price, volume = candle
                        
                        # Handle timestamp conversion
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
                            'timestamp': timestamp,
                            'change': 0,
                            'changePercent': 0
                        }
                        
                        result.append(data_point)
                    except Exception as candle_error:
                        logger.error(f"❌ Error processing candle for {symbol}: {candle_error}")
                        continue
                
                # Calculate change and change percent
                if result:
                    prev_close = result[0]['open']
                    for point in result:
                        try:
                            point['change'] = point['ltp'] - prev_close
                            point['changePercent'] = (point['change'] / prev_close) * 100 if prev_close else 0
                        except:
                            point['change'] = 0
                            point['changePercent'] = 0
                
                return result
            else:
                error_msg = response.get('message', 'Unknown error')
                error_code = response.get('code', 'No code')
                logger.error(f"❌ API error for {symbol}: Code={error_code}, Message={error_msg}")
                
                # Add to failed symbols to prevent immediate retry
                record_symbol_failure(symbol)
                return []
                
        except Exception as api_error:
            logger.error(f"❌ API call exception for {symbol}: {api_error}")
            record_symbol_failure(symbol)
            return []
        
    except Exception as e:
        logger.error(f"❌ Error fetching historical data for {symbol}: {e}")
        record_symbol_failure(symbol)
        return []

def enhanced_auth_file_watcher():
    """Enhanced auth file watcher with better initialization."""
    global fyers, fyers_client, access_token, running, auth_initialized
    
    auth_file_path = os.path.join('data', 'fyers_data_auth.json')
    last_modified = 0
    
    while running:
        try:
            if os.path.exists(auth_file_path):
                current_modified = os.path.getmtime(auth_file_path)
                
                # Check if file was modified or if we don't have a connection yet
                if current_modified > last_modified or not auth_initialized:
                    logger.info("🔄 Auth file updated or connection missing, initializing Fyers...")
                    
                    if initialize_fyers_from_auth_file():
                        # Start Fyers WebSocket connection if available
                        if fyers and not hasattr(fyers, '_connected'):
                            try:
                                fyers_thread = threading.Thread(target=lambda: fyers.connect(), daemon=True)
                                fyers_thread.start()
                                logger.info("✅ Fyers WebSocket connection started")
                            except Exception as ws_error:
                                logger.error(f"❌ Failed to start WebSocket: {ws_error}")
                    else:
                        logger.warning("⚠️ Failed to initialize Fyers from auth file")
                    
                    last_modified = current_modified
            else:
                if auth_initialized:  # If we had a connection but file is gone
                    logger.warning("⚠️ Auth file removed, clearing connection")
                    fyers_client = None
                    fyers = None
                    access_token = None
                    auth_initialized = False
            
            time.sleep(5)  # Check every 5 seconds
            
        except Exception as e:
            logger.error(f"❌ Error in auth file watcher: {e}")
            time.sleep(10)  # Wait longer on error

# ============= PORT 5001 EVENT HANDLERS =============
@sio_5001.event
def connect(sid, environ):
    """Handle client connection on port 5001."""
    logger.info(f"[5001] Client connected: {sid}")
    clients_5001[sid] = {
        'subscriptions': set(),
        'connected_at': time.time(),
        'last_ping': time.time()
    }
    
    # Send connection confirmation
    sio_5001.emit('connected', {
        'status': 'connected',
        'server_time': time.time(),
        'fyers_status': 'connected' if auth_initialized else 'disconnected',
        'auth_status': auth_initialized
    }, room=sid)

@sio_5001.event
def disconnect(sid):
    """Handle client disconnection on port 5001."""
    logger.info(f"[5001] Client disconnected: {sid}")
    if sid in clients_5001:
        # Clean up subscriptions
        for symbol in clients_5001[sid]['subscriptions']:
            if symbol in symbol_to_clients_5001:
                symbol_to_clients_5001[symbol].discard(sid)
                # If no more clients for this symbol, unsubscribe
                if not symbol_to_clients_5001[symbol]:
                    del symbol_to_clients_5001[symbol]
        
        del clients_5001[sid]

@sio_5001.event
def subscribe(sid, data):
    """ENHANCED: Handle subscription requests with better error handling."""
    if sid not in clients_5001:
        logger.warning(f"[5001] Unknown client {sid} trying to subscribe")
        sio_5001.emit('error', {'message': 'Client not registered'}, room=sid)
        return
    
    symbol = data.get('symbol')
    if not symbol:
        sio_5001.emit('error', {'message': 'No symbol provided'}, room=sid)
        return
    
    logger.info(f"[5001] Client {sid} subscribing to {symbol}")
    
    clients_5001[sid]['subscriptions'].add(symbol)
    if symbol not in symbol_to_clients_5001:
        symbol_to_clients_5001[symbol] = set()
    symbol_to_clients_5001[symbol].add(sid)
    
    # Check if we already have historical data
    if symbol in historical_data_5001 and historical_data_5001[symbol]:
        # Send cached data immediately
        hist_data_list = list(historical_data_5001[symbol])
        sio_5001.emit('historicalData', {
            'symbol': symbol,
            'data': hist_data_list
        }, room=sid)
        logger.info(f"[5001] Sent cached historical data for {symbol}")
    else:
        # Fetch new data in background to avoid blocking
        def fetch_and_send():
            try:
                if is_symbol_in_cooldown(symbol):
                    logger.debug(f"[5001] Symbol {symbol} in cooldown, sending empty data")
                    sio_5001.emit('historicalData', {
                        'symbol': symbol,
                        'data': []
                    }, room=sid)
                    return
                
                logger.info(f"[5001] Fetching historical data for {symbol}")
                hist_data = fetch_historical_intraday_data(symbol)
                
                if symbol not in historical_data_5001:
                    historical_data_5001[symbol] = deque(maxlen=MAX_HISTORY_POINTS)
                
                for data_point in hist_data:
                    historical_data_5001[symbol].append(data_point)
                
                # Send data to client
                sio_5001.emit('historicalData', {
                    'symbol': symbol,
                    'data': hist_data
                }, room=sid)
                
                if hist_data:
                    logger.info(f"[5001] Sent {len(hist_data)} historical points for {symbol}")
                else:
                    logger.warning(f"[5001] No historical data available for {symbol}")
                    
            except Exception as e:
                logger.error(f"[5001] Error fetching data for {symbol}: {e}")
                sio_5001.emit('error', {'message': f'Failed to fetch data for {symbol}'}, room=sid)
        
        # Execute in background thread
        threading.Thread(target=fetch_and_send, daemon=True).start()
    
    return {'success': True, 'symbol': symbol}

@sio_5001.event
def unsubscribe(sid, data):
    """Handle unsubscription requests from clients on port 5001."""
    symbol = data.get('symbol')
    if not symbol:
        return {'success': False, 'error': 'No symbol provided'}
    
    logger.info(f"[5001] Client {sid} unsubscribing from {symbol}")
    
    if sid in clients_5001:
        clients_5001[sid]['subscriptions'].discard(symbol)
    
    if symbol in symbol_to_clients_5001:
        symbol_to_clients_5001[symbol].discard(sid)
        
        if not symbol_to_clients_5001[symbol]:
            logger.info(f"[5001] No more clients for {symbol}")
    
    return {'success': True, 'symbol': symbol}

@sio_5001.event
def get_trading_status(sid, data):
    """Get trading status on port 5001."""
    start_time, end_time = get_trading_hours()
    return {
        'trading_active': is_trading_hours(),
        'trading_start': start_time.isoformat(),
        'trading_end': end_time.isoformat(),
        'current_time': datetime.datetime.now(INDIA_TZ).isoformat(),
        'is_market_day': datetime.datetime.now(INDIA_TZ).weekday() < 5,
        'auth_status': auth_initialized,
        'fyers_connected': bool(fyers_client)
    }

# ============= PORT 5010 EVENT HANDLERS =============
@sio_5010.event
def connect(sid, environ):
    """Handle client connection on port 5010."""
    logger.info(f"[5010] Client connected: {sid}")
    clients_5010[sid] = {
        'subscriptions': set(),
        'connected_at': datetime.datetime.now(INDIA_TZ),
        'last_activity': datetime.datetime.now(INDIA_TZ)
    }
    
    # Send available symbols to client
    sio_5010.emit('availableSymbols', {
        'symbols': available_symbols,
        'maxCompanies': MAX_COMPANIES,
        'tradingHours': {
            'isActive': is_trading_hours(),
            'start': get_trading_hours()[0].isoformat(),
            'end': get_trading_hours()[1].isoformat()
        },
        'authStatus': auth_initialized,
        'fyersConnected': bool(fyers_client)
    }, room=sid)

@sio_5010.event
def disconnect(sid):
    """Handle client disconnection on port 5010."""
    logger.info(f"[5010] Client disconnected: {sid}")
    if sid in clients_5010:
        # Clean up subscriptions
        for symbol in clients_5010[sid]['subscriptions']:
            if symbol in symbol_to_clients_5010:
                symbol_to_clients_5010[symbol].discard(sid)
                
                # If no more clients for this symbol, unsubscribe
                if not symbol_to_clients_5010[symbol]:
                    active_subscriptions_5010.discard(symbol)
                    logger.info(f"[5010] Removed {symbol} from active subscriptions")
        
        del clients_5010[sid]

@sio_5010.event
def subscribe_companies(sid, data):
    """ENHANCED: Subscribe to selected companies with better error handling."""
    try:
        logger.info(f"[5010] 📡 Received subscription request from {sid}: {data}")
        
        company_codes = data.get('companyCodes', [])
        logger.info(f"[5010] 📡 Raw company codes: {company_codes}")
        
        if not isinstance(company_codes, list):
            logger.error(f"[5010] ❌ Invalid data type for companyCodes: {type(company_codes)}")
            sio_5010.emit('error', {'message': 'companyCodes must be an array'}, room=sid)
            return
        
        # Validate company codes
        valid_company_codes = []
        for code in company_codes:
            if isinstance(code, str) and code.strip():
                valid_company_codes.append(code.strip().upper())
            else:
                logger.warning(f"[5010] ⚠️ Skipping invalid company code: {code}")
        
        logger.info(f"[5010] ✅ Valid company codes after filtering: {valid_company_codes}")
        
        # Check limits
        if len(valid_company_codes) > MAX_COMPANIES:
            logger.error(f"[5010] ❌ Too many companies requested: {len(valid_company_codes)}")
            sio_5010.emit('error', {'message': f'Maximum {MAX_COMPANIES} companies allowed'}, room=sid)
            return
        
        if len(valid_company_codes) == 0:
            logger.error(f"[5010] ❌ No valid company codes provided")
            sio_5010.emit('error', {'message': 'At least 1 valid company code must be provided'}, room=sid)
            return
        
        # Clear existing subscriptions for this client
        if sid in clients_5010:
            for symbol in clients_5010[sid]['subscriptions']:
                if symbol in symbol_to_clients_5010:
                    symbol_to_clients_5010[symbol].discard(sid)
                    if not symbol_to_clients_5010[symbol]:
                        active_subscriptions_5010.discard(symbol)
            clients_5010[sid]['subscriptions'].clear()
        
        # Process valid company codes
        requested_symbols = []
        for company_code in valid_company_codes:
            logger.info(f"[5010] 📡 Processing company code: {company_code}")
            
            # Try to find in existing available symbols
            symbol_data = next(
                (s for s in available_symbols if s['company_code'] == company_code),
                None
            )
            
            if symbol_data:
                requested_symbols.append(symbol_data['symbol'])
                logger.info(f"[5010] ✅ Found existing symbol for {company_code}: {symbol_data['symbol']}")
            else:
                # Dynamically create symbol
                new_symbol_data = add_symbol_to_available(company_code)
                requested_symbols.append(new_symbol_data['symbol'])
                logger.info(f"[5010] ✅ Dynamically created symbol for {company_code}: {new_symbol_data['symbol']}")
        
        logger.info(f"[5010] 📡 Final requested symbols: {requested_symbols}")
        
        # Update client subscriptions
        if sid not in clients_5010:
            clients_5010[sid] = {
                'subscriptions': set(),
                'connected_at': datetime.datetime.now(INDIA_TZ),
                'last_activity': datetime.datetime.now(INDIA_TZ)
            }
        
        # Add symbols to client subscriptions
        for symbol in requested_symbols:
            clients_5010[sid]['subscriptions'].add(symbol)
            
            # Add to symbol_to_clients mapping
            if symbol not in symbol_to_clients_5010:
                symbol_to_clients_5010[symbol] = set()
            symbol_to_clients_5010[symbol].add(sid)
            
            # Add to active subscriptions
            active_subscriptions_5010.add(symbol)
            logger.info(f"[5010] ✅ Added {symbol} to active subscriptions")
        
        # Send subscription confirmation first
        sio_5010.emit('subscriptionConfirm', {
            'success': True,
            'symbols': requested_symbols,
            'count': len(requested_symbols),
            'authStatus': auth_initialized
        }, room=sid)
        
        # Fetch historical data in background
        def fetch_all_historical_data():
            for symbol in requested_symbols:
                try:
                    # Send any existing cached data immediately
                    if symbol in historical_data_5010 and historical_data_5010[symbol]:
                        sio_5010.emit('historicalData', {
                            'symbol': symbol,
                            'data': list(historical_data_5010[symbol])
                        }, room=sid)
                        logger.info(f"[5010] 📊 Sent cached historical data for {symbol}")
                    else:
                        # Check if symbol is in cooldown
                        if is_symbol_in_cooldown(symbol):
                            logger.debug(f"[5010] Symbol {symbol} in cooldown, sending empty data")
                            sio_5010.emit('historicalData', {
                                'symbol': symbol,
                                'data': []
                            }, room=sid)
                            continue
                        
                        # Fetch historical data
                        logger.info(f"[5010] 📊 Fetching historical data for {symbol}")
                        hist_data = fetch_historical_intraday_data(symbol)
                        
                        if hist_data:
                            if symbol not in historical_data_5010:
                                historical_data_5010[symbol] = deque(maxlen=MAX_HISTORY_POINTS)
                            
                            for data_point in hist_data:
                                historical_data_5010[symbol].append(data_point)
                            
                            sio_5010.emit('historicalData', {
                                'symbol': symbol,
                                'data': hist_data
                            }, room=sid)
                            logger.info(f"[5010] 📊 Sent fresh historical data for {symbol} ({len(hist_data)} points)")
                        else:
                            # Send empty data to indicate no data available
                            sio_5010.emit('historicalData', {
                                'symbol': symbol,
                                'data': []
                            }, room=sid)
                            logger.warning(f"[5010] ⚠️ No historical data available for {symbol}")
                        
                        # Add small delay between requests to respect rate limits
                        time.sleep(0.1)
                        
                except Exception as symbol_error:
                    logger.error(f"[5010] ❌ Error fetching data for {symbol}: {symbol_error}")
                    sio_5010.emit('historicalData', {
                        'symbol': symbol,
                        'data': []
                    }, room=sid)
        
        # Execute in background thread
        threading.Thread(target=fetch_all_historical_data, daemon=True).start()
        
        logger.info(f"[5010] ✅ Successfully subscribed client {sid} to {len(requested_symbols)} symbols")
        
    except Exception as e:
        logger.error(f"[5010] ❌ Error in subscribe_companies: {e}")
        import traceback
        traceback.print_exc()
        sio_5010.emit('error', {'message': f'Subscription failed: {str(e)}'}, room=sid)

@sio_5010.event
def unsubscribe_all(sid, data):
    """Unsubscribe from all companies on port 5010."""
    try:
        logger.info(f"[5010] 📡 Unsubscribing all for client {sid}")
        
        if sid in clients_5010:
            for symbol in clients_5010[sid]['subscriptions']:
                if symbol in symbol_to_clients_5010:
                    symbol_to_clients_5010[symbol].discard(sid)
                    if not symbol_to_clients_5010[symbol]:
                        active_subscriptions_5010.discard(symbol)
            
            clients_5010[sid]['subscriptions'].clear()
        
        sio_5010.emit('subscriptionConfirm', {
            'success': True,
            'symbols': [],
            'count': 0
        }, room=sid)
        
        logger.info(f"[5010] ✅ Client {sid} unsubscribed from all symbols")
        
    except Exception as e:
        logger.error(f"[5010] ❌ Error in unsubscribe_all: {e}")
        sio_5010.emit('error', {'message': f'Unsubscription failed: {str(e)}'}, room=sid)

@sio_5010.event
def get_market_status(sid, data):
    """Get current market status on port 5010."""
    try:
        start_time, end_time = get_trading_hours()
        sio_5010.emit('marketStatus', {
            'trading_active': is_trading_hours(),
            'trading_start': start_time.isoformat(),
            'trading_end': end_time.isoformat(),
            'current_time': datetime.datetime.now(INDIA_TZ).isoformat(),
            'is_market_day': datetime.datetime.now(INDIA_TZ).weekday() < 5,
            'active_subscriptions': len(active_subscriptions_5010),
            'connected_clients': len(clients_5010),
            'auth_status': auth_initialized,
            'fyers_connected': bool(fyers_client)
        }, room=sid)
    except Exception as e:
        logger.error(f"[5010] ❌ Error in get_market_status: {e}")
        sio_5010.emit('error', {'message': f'Failed to get market status: {str(e)}'}, room=sid)

# ============= FYERS WEBSOCKET HANDLERS =============
def onmessage(message):
    """Handle incoming Fyers WebSocket messages for both ports."""
    try:
        # Skip system messages
        if isinstance(message, dict) and message.get('type') in ['sub', 'cn', 'ful']:
            logger.debug(f"📡 System message: {message}")
            return
        
        # Process market data
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
            
            # ============= PORT 5001 PROCESSING =============
            # Store historical data for port 5001
            if symbol not in historical_data_5001:
                historical_data_5001[symbol] = deque(maxlen=MAX_HISTORY_POINTS)
            
            historical_data_5001[symbol].append(simplified_data)
            
            # Send data to subscribed clients on port 5001
            if symbol in symbol_to_clients_5001:
                disconnected_clients = set()
                
                for sid in list(symbol_to_clients_5001[symbol]):
                    try:
                        sio_5001.emit('marketData', simplified_data, room=sid)
                    except Exception as e:
                        logger.error(f"[5001] Error sending data to client {sid}: {e}")
                        disconnected_clients.add(sid)
                
                # Clean up disconnected clients
                for sid in disconnected_clients:
                    symbol_to_clients_5001[symbol].discard(sid)
                    if sid in clients_5001:
                        del clients_5001[sid]
                
                # Remove symbol if no clients left
                if not symbol_to_clients_5001[symbol]:
                    del symbol_to_clients_5001[symbol]
            
            # ============= PORT 5010 PROCESSING =============
            # Only process if symbol is actively subscribed on port 5010
            if symbol in active_subscriptions_5010:
                # Store real-time data
                real_time_data_5010[symbol] = simplified_data
                
                # Store historical data for port 5010
                if symbol not in historical_data_5010:
                    historical_data_5010[symbol] = deque(maxlen=MAX_HISTORY_POINTS)
                
                historical_data_5010[symbol].append(simplified_data)
                
                # Send to subscribed clients on port 5010
                if symbol in symbol_to_clients_5010:
                    for sid in symbol_to_clients_5010[symbol]:
                        try:
                            sio_5010.emit('marketData', simplified_data, room=sid)
                        except Exception as e:
                            logger.error(f"[5010] ❌ Error sending data to client {sid}: {e}")
                
                logger.debug(f"📈 Processed market data for {symbol}: LTP={simplified_data['ltp']}")
            
    except Exception as e:
        logger.error(f"❌ Error processing message: {e}")

def onopen():
    """Handle Fyers WebSocket connection opening."""
    logger.info("✅ Fyers WebSocket connected")
    sio_5001.emit('fyersConnected', {'status': 'connected'})
    sio_5010.emit('fyersConnected', {'status': 'connected'})
    
    # Subscribe to all active symbols
    all_symbols = set()
    all_symbols.update(symbol_to_clients_5001.keys())
    all_symbols.update(active_subscriptions_5010)
    
    if all_symbols and fyers:
        try:
            symbol_list = list(all_symbols)
            logger.info(f"📡 Subscribing to {len(symbol_list)} symbols: {symbol_list}")
            fyers.subscribe(symbol_list)
        except Exception as e:
            logger.error(f"❌ Error subscribing to symbols: {e}")
    
    logger.info("📡 Fyers connection established, ready for subscriptions")

def onerror(error):
    """Handle Fyers WebSocket errors."""
    logger.error(f"❌ Fyers WebSocket Error: {error}")
    sio_5001.emit('fyersError', {'message': str(error)})
    sio_5010.emit('fyersError', {'message': str(error)})

def onclose(message):
    """Handle Fyers WebSocket connection closure."""
    logger.info(f"❌ Fyers WebSocket Connection closed: {message}")
    sio_5001.emit('fyersDisconnected', {'message': str(message)})
    sio_5010.emit('fyersDisconnected', {'message': str(message)})

# ============= HEARTBEAT AND MONITORING =============
def heartbeat_task():
    """Send periodic heartbeat to clients on both ports."""
    global running
    while running:
        try:
            heartbeat_data = {
                'timestamp': int(time.time()),
                'trading_active': is_trading_hours(),
                'server_status': 'healthy',
                'auth_status': auth_initialized,
                'fyers_connected': bool(fyers_client),
                'rate_limit_status': {
                    'current_calls': len(api_call_timestamps),
                    'max_calls_per_second': RATE_LIMIT_PER_SECOND,
                    'failed_symbols_count': len(failed_symbols)
                }
            }
            
            # Send to port 5001
            heartbeat_data_5001 = {
                **heartbeat_data,
                'connected_clients': len(clients_5001),
                'active_symbols': len(symbol_to_clients_5001)
            }
            sio_5001.emit('heartbeat', heartbeat_data_5001)
            
            # Send to port 5010
            heartbeat_data_5010 = {
                **heartbeat_data,
                'connected_clients': len(clients_5010),
                'active_subscriptions': len(active_subscriptions_5010)
            }
            sio_5010.emit('heartbeat', heartbeat_data_5010)
            
            time.sleep(30)  # Send heartbeat every 30 seconds
        except Exception as e:
            logger.error(f"❌ Error in heartbeat: {e}")
            time.sleep(30)

def cleanup_disconnected_clients():
    """Periodic cleanup of disconnected clients on both ports."""
    current_time = time.time()
    
    # Cleanup port 5001 clients
    disconnected_clients_5001 = []
    for sid, client_data in clients_5001.items():
        if current_time - client_data.get('last_ping', client_data['connected_at']) > 120:  # 2 minutes
            disconnected_clients_5001.append(sid)
    
    for sid in disconnected_clients_5001:
        logger.info(f"[5001] Cleaning up inactive client: {sid}")
        if sid in clients_5001:
            del clients_5001[sid]
    
    # Cleanup port 5010 clients
    disconnected_clients_5010 = []
    current_dt = datetime.datetime.now(INDIA_TZ)
    for sid, client_data in clients_5010.items():
        time_diff = (current_dt - client_data['last_activity']).total_seconds()
        if time_diff > 120:  # 2 minutes
            disconnected_clients_5010.append(sid)
    
    for sid in disconnected_clients_5010:
        logger.info(f"[5010] Cleaning up inactive client: {sid}")
        if sid in clients_5010:
            del clients_5010[sid]

# ============= SERVER STARTUP =============
def start_server_5001():
    """Start server on port 5001."""
    try:
        logger.info("🚀 Starting server on port 5001...")
        eventlet.wsgi.server(eventlet.listen(('0.0.0.0', 5001)), app_5001)
    except Exception as e:
        logger.error(f"❌ Error starting server 5001: {e}")

def start_server_5010():
    """Start server on port 5010."""
    try:
        logger.info("🚀 Starting server on port 5010...")
        eventlet.wsgi.server(eventlet.listen(('0.0.0.0', 5010)), app_5010)
    except Exception as e:
        logger.error(f"❌ Error starting server 5010: {e}")

def main():
    """Main function to start both servers with enhanced authentication and rate limiting."""
    global running
    
    logger.info("=" * 80)
    logger.info("🚀 Starting Enhanced Unified Fyers Data Server")
    logger.info("📡 Port 5001: Basic Fyers Data Service")
    logger.info("📡 Port 5010: Advanced Live Market Service")
    logger.info("🔐 Authentication: Enhanced with rate limiting and error recovery")
    logger.info("⚡ Rate Limiting: Max 2 API calls per second")
    logger.info("🛡️ Error Recovery: 5-minute cooldown for failed symbols")
    logger.info("=" * 80)
    
    try:
        # Create data directory
        os.makedirs('data', exist_ok=True)
        
        # Load available symbols
        load_available_symbols()
        
        # Try to initialize Fyers from existing auth
        if initialize_fyers_from_auth_file():
            logger.info("✅ Initial Fyers initialization successful")
        else:
            logger.info("ℹ️ No valid authentication found, will monitor for updates")
        
        # Start background tasks
        heartbeat_thread = threading.Thread(target=heartbeat_task, daemon=True)
        heartbeat_thread.start()
        
        # Enhanced auth watcher
        auth_watcher_thread = threading.Thread(target=enhanced_auth_file_watcher, daemon=True)
        auth_watcher_thread.start()
        
        # Start Fyers connection if available
        if fyers:
            try:
                fyers_thread = threading.Thread(target=lambda: fyers.connect(), daemon=True)
                fyers_thread.start()
                logger.info("✅ Fyers WebSocket connection started")
            except Exception as e:
                logger.error(f"❌ Failed to start WebSocket: {e}")
        
        # Start periodic cleanup
        def periodic_cleanup():
            while running:
                time.sleep(60)  # Run cleanup every minute
                try:
                    cleanup_disconnected_clients()
                    
                    # Clean up old failed symbols (every hour)
                    current_time = time.time()
                    expired_symbols = [
                        symbol for symbol, fail_time in failed_symbols.items()
                        if current_time - fail_time > FAILED_SYMBOL_COOLDOWN
                    ]
                    for symbol in expired_symbols:
                        del failed_symbols[symbol]
                        logger.info(f"🔄 Removed {symbol} from failed symbols cooldown")
                        
                except Exception as e:
                    logger.error(f"❌ Error in periodic cleanup: {e}")
        
        cleanup_thread = threading.Thread(target=periodic_cleanup, daemon=True)
        cleanup_thread.start()
        
        # Start both servers in separate threads
        server_5001_thread = threading.Thread(target=start_server_5001, daemon=True)
        server_5010_thread = threading.Thread(target=start_server_5010, daemon=True)
        
        server_5001_thread.start()
        server_5010_thread.start()
        
        logger.info("✅ Both servers started successfully")
        logger.info("🔄 Servers running with enhanced error recovery and rate limiting")
        
        # Keep main thread alive
        while running:
            time.sleep(1)
            
    except KeyboardInterrupt:
        logger.info("🛑 Shutdown requested by user")
        running = False
    except Exception as e:
        logger.error(f"❌ Fatal error in main: {e}")
        import traceback
        traceback.print_exc()
        running = False

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        logger.info("🛑 Shutting down gracefully...")
        running = False
    except Exception as e:
        logger.error(f"❌ Fatal error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        logger.info("🔚 Server shutdown complete")
