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
import pandas as pd

# Enhanced logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(f'fyers_5001_{datetime.datetime.now().strftime("%Y%m%d")}.log', encoding='utf-8'),
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger("Fyers5001")

# Socket.IO setup
sio = socketio.Server(cors_allowed_origins='*', async_mode='eventlet')
app = socketio.WSGIApp(sio)

# Configuration
client_id = "150HUKJSWG-100"
INDIA_TZ = pytz.timezone('Asia/Kolkata')
MAX_HISTORY_POINTS = 10000

# Global variables
clients = {}
symbol_to_clients = {}
historical_data = {}
fyers_client = None
auth_initialized = False
running = True
last_connection_test = 0

# ADDED: Rate limiting and error tracking (same as port 5010)
api_call_timestamps = deque(maxlen=50)
failed_symbols = {}
RATE_LIMIT_PER_SECOND = 2
FAILED_SYMBOL_COOLDOWN = 300  # 5 minutes

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
        return full_token.split(':', 1)[1]
    else:
        return full_token

# ADDED: Rate limiting functions (same as port 5010)
def can_make_api_call():
    """Check if we can make an API call based on rate limiting."""
    current_time = time.time()
    
    # Remove old timestamps (older than 1 second)
    while api_call_timestamps and current_time - api_call_timestamps[0] > 1:
        api_call_timestamps.popleft()
    
    return len(api_call_timestamps) < RATE_LIMIT_PER_SECOND

def record_api_call():
    """Record an API call timestamp."""
    api_call_timestamps.append(time.time())

def is_symbol_in_cooldown(symbol):
    """Check if a symbol is in cooldown due to recent failures."""
    if symbol not in failed_symbols:
        return False
    
    current_time = time.time()
    if current_time - failed_symbols[symbol] > FAILED_SYMBOL_COOLDOWN:
        del failed_symbols[symbol]
        return False
    
    return True

def record_symbol_failure(symbol):
    """Record a symbol failure."""
    failed_symbols[symbol] = time.time()
    logger.warning(f"🚫 Symbol {symbol} added to cooldown for {FAILED_SYMBOL_COOLDOWN} seconds")

def test_fyers_connection():
    """Test Fyers API connection."""
    global last_connection_test
    
    try:
        current_time = time.time()
        if current_time - last_connection_test < 30:
            return True, "Recent test passed"
        
        logger.info("🧪 Testing Fyers API connection...")
        response = fyers_client.get_profile()
        last_connection_test = current_time
        
        if response and response.get('s') == 'ok':
            user_data = response.get('data', {})
            user_name = user_data.get('name', 'Unknown')
            logger.info(f"✅ API connection successful - User: {user_name}")
            return True, "Connection successful"
        else:
            logger.error(f"❌ API test failed: {response}")
            return False, f"API test failed: {response}"
            
    except Exception as e:
        logger.error(f"❌ Connection test error: {e}")
        return False, f"Connection test error: {e}"

def initialize_fyers():
    """Initialize Fyers client from auth file."""
    global fyers_client, auth_initialized
    
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
        
        # Extract only the JWT token for REST API
        jwt_token = extract_jwt_token(full_access_token)
        logger.info(f"🔍 Extracted JWT token: {jwt_token[:30]}...")
        
        # Initialize Fyers client with JWT token only
        try:
            fyers_client = fyersModel.FyersModel(
                client_id=client_id,
                token=jwt_token,  # Use JWT token only for REST API
                log_path=""
            )
            
            # Test connection
            success, message = test_fyers_connection()
            if success:
                auth_initialized = True
                logger.info("✅ Fyers client initialized successfully")
                return True
            else:
                logger.error(f"❌ Connection test failed: {message}")
                return False
                
        except Exception as e:
            logger.error(f"❌ Failed to initialize Fyers client: {e}")
            return False
        
    except Exception as e:
        logger.error(f"❌ Error loading auth data: {e}")
        return False

def fetch_historical_data(symbol, date=None):
    """ENHANCED: Fetch historical intraday data with proper error handling."""
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
            time.sleep(0.5)
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
        
        logger.info(f"📊 Fetching data for {symbol} from {from_date} to {to_date}")
        
        # FIXED: Use exact same format as working port 5010
        data_args = {
            "symbol": symbol,
            "resolution": "1",
            "date_format": "1",
            "range_from": from_date,
            "range_to": to_date,
            "cont_flag": "1"
        }
        
        logger.debug(f"🔍 API request for {symbol}: {data_args}")
        
        # Make the API call with proper error handling
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

# Socket.IO Event Handlers
@sio.event
def connect(sid, environ):
    """Handle client connection."""
    logger.info(f"[5001] Client connected: {sid}")
    clients[sid] = {
        'subscriptions': set(),
        'connected_at': time.time()
    }
    
    sio.emit('connected', {
        'status': 'connected',
        'server_time': time.time(),
        'auth_status': auth_initialized
    }, room=sid)

@sio.event
def disconnect(sid):
    """Handle client disconnection."""
    logger.info(f"[5001] Client disconnected: {sid}")
    if sid in clients:
        for symbol in clients[sid]['subscriptions']:
            if symbol in symbol_to_clients:
                symbol_to_clients[symbol].discard(sid)
                if not symbol_to_clients[symbol]:
                    del symbol_to_clients[symbol]
        del clients[sid]

@sio.event
def subscribe(sid, data):
    """ENHANCED: Handle subscription requests with better error handling."""
    symbol = data.get('symbol')
    if not symbol:
        sio.emit('error', {'message': 'No symbol provided'}, room=sid)
        return
    
    logger.info(f"[5001] Client {sid} subscribing to {symbol}")
    
    if sid in clients:
        clients[sid]['subscriptions'].add(symbol)
        
        if symbol not in symbol_to_clients:
            symbol_to_clients[symbol] = set()
        symbol_to_clients[symbol].add(sid)
        
        # Check if we already have cached data
        if symbol in historical_data and historical_data[symbol]:
            # Send cached data immediately
            hist_data_list = list(historical_data[symbol])
            sio.emit('historicalData', {
                'symbol': symbol,
                'data': hist_data_list
            }, room=sid)
            logger.info(f"[5001] Sent cached data for {symbol} ({len(hist_data_list)} points)")
        else:
            # Fetch new data in background
            def fetch_and_send():
                try:
                    if is_symbol_in_cooldown(symbol):
                        logger.debug(f"[5001] Symbol {symbol} in cooldown, sending empty data")
                        sio.emit('historicalData', {
                            'symbol': symbol,
                            'data': []
                        }, room=sid)
                        return
                    
                    hist_data = fetch_historical_data(symbol)
                    
                    if symbol not in historical_data:
                        historical_data[symbol] = deque(maxlen=MAX_HISTORY_POINTS)
                    
                    for data_point in hist_data:
                        historical_data[symbol].append(data_point)
                    
                    sio.emit('historicalData', {
                        'symbol': symbol,
                        'data': hist_data
                    }, room=sid)
                    
                    if hist_data:
                        logger.info(f"[5001] Sent {len(hist_data)} data points for {symbol}")
                    else:
                        logger.warning(f"[5001] No data available for {symbol}")
                    
                except Exception as e:
                    logger.error(f"[5001] Error fetching data for {symbol}: {e}")
                    sio.emit('error', {'message': f'Failed to fetch data for {symbol}'}, room=sid)
            
            threading.Thread(target=fetch_and_send, daemon=True).start()
    
    return {'success': True, 'symbol': symbol}

@sio.event
def unsubscribe(sid, data):
    """Handle unsubscription requests."""
    symbol = data.get('symbol')
    if not symbol:
        return {'success': False, 'error': 'No symbol provided'}
    
    logger.info(f"[5001] Client {sid} unsubscribing from {symbol}")
    
    if sid in clients:
        clients[sid]['subscriptions'].discard(symbol)
    
    if symbol in symbol_to_clients:
        symbol_to_clients[symbol].discard(sid)
        if not symbol_to_clients[symbol]:
            del symbol_to_clients[symbol]
    
    return {'success': True, 'symbol': symbol}

@sio.event
def get_trading_status(sid, data):
    """Get trading status."""
    start_time, end_time = get_trading_hours()
    return {
        'trading_active': is_trading_hours(),
        'trading_start': start_time.isoformat(),
        'trading_end': end_time.isoformat(),
        'current_time': datetime.datetime.now(INDIA_TZ).isoformat(),
        'auth_status': auth_initialized
    }

def auth_watcher():
    """Watch for auth file changes."""
    global running
    auth_file_path = os.path.join('data', 'fyers_data_auth.json')
    last_modified = 0
    
    while running:
        try:
            if os.path.exists(auth_file_path):
                current_modified = os.path.getmtime(auth_file_path)
                if current_modified > last_modified or not auth_initialized:
                    # Only reinitialize if not already successful
                    if not auth_initialized:
                        logger.info("🔄 Auth file updated, reinitializing...")
                        initialize_fyers()
                    last_modified = current_modified
            time.sleep(5)
        except Exception as e:
            logger.error(f"❌ Auth watcher error: {e}")
            time.sleep(10)

def heartbeat():
    """Send periodic heartbeat."""
    global running
    while running:
        try:
            sio.emit('heartbeat', {
                'timestamp': int(time.time()),
                'connected_clients': len(clients),
                'active_symbols': len(symbol_to_clients),
                'auth_status': auth_initialized,
                'trading_active': is_trading_hours(),
                'rate_limit_status': {
                    'current_calls': len(api_call_timestamps),
                    'max_calls_per_second': RATE_LIMIT_PER_SECOND,
                    'failed_symbols_count': len(failed_symbols)
                }
            })
            time.sleep(30)
        except Exception as e:
            logger.error(f"❌ Heartbeat error: {e}")
            time.sleep(30)

def cleanup_failed_symbols():
    """Periodic cleanup of failed symbols."""
    global running
    while running:
        try:
            current_time = time.time()
            expired_symbols = [
                symbol for symbol, fail_time in failed_symbols.items()
                if current_time - fail_time > FAILED_SYMBOL_COOLDOWN
            ]
            for symbol in expired_symbols:
                del failed_symbols[symbol]
                logger.info(f"🔄 Removed {symbol} from failed symbols cooldown")
            
            time.sleep(60)  # Run cleanup every minute
        except Exception as e:
            logger.error(f"❌ Cleanup error: {e}")
            time.sleep(60)

def main():
    """Main function."""
    global running
    
    logger.info("🚀 Starting Fyers Service 5001 - Historical Data Service (Enhanced)")
    
    try:
        # Create data directory
        os.makedirs('data', exist_ok=True)
        
        # Initialize Fyers
        if initialize_fyers():
            logger.info("✅ Initial authentication successful")
        else:
            logger.info("⚠️ Initial authentication failed, will retry when auth file updates")
        
        # Start background tasks
        auth_thread = threading.Thread(target=auth_watcher, daemon=True)
        heartbeat_thread = threading.Thread(target=heartbeat, daemon=True)
        cleanup_thread = threading.Thread(target=cleanup_failed_symbols, daemon=True)
        
        auth_thread.start()
        heartbeat_thread.start()
        cleanup_thread.start()
        
        logger.info("✅ Service 5001 started successfully on port 5001")
        logger.info("🔑 Using JWT token extraction for REST API calls")
        logger.info("⚡ Rate limiting: Max 2 API calls per second")
        logger.info("🛡️ Error recovery: 5-minute cooldown for failed symbols")
        
        # Start server
        eventlet.wsgi.server(eventlet.listen(('0.0.0.0', 5001)), app)
        
    except KeyboardInterrupt:
        logger.info("🛑 Shutdown requested")
        running = False
    except Exception as e:
        logger.error(f"❌ Fatal error: {e}")
        running = False

if __name__ == "__main__":
    main()
