import socketio
import json
import sys
import time
import datetime
import pytz
import logging
import asyncio
import numpy as np
import os
from collections import deque, defaultdict
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FuturesTimeoutError
from fyers_apiv3 import fyersModel
from fyers_apiv3.FyersWebsocket import data_ws
import pandas as pd
import uvicorn
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
import requests

# Enhanced logging configuration
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[logging.StreamHandler(sys.stdout)]
)
logger = logging.getLogger("LiveMarketServer5010")

# Async Socket.IO setup (replaces eventlet)
sio = socketio.AsyncServer(
    async_mode='asgi',
    cors_allowed_origins='*',
    logger=False,
    engineio_logger=False,
    ping_timeout=60,
    ping_interval=25
)
app = socketio.ASGIApp(sio)

from dotenv import load_dotenv
# ✅ MULTI-INSTANCE SUPPORT: Check DAKS_ENV_FILE for custom env path
# Default: uses apps/backend/.env (unchanged behavior)
# Instance mode: set DAKS_ENV_FILE=/path/to/instance/.env
_default_env = os.path.join(os.path.dirname(__file__), ".env")
_env_file = os.environ.get('DAKS_ENV_FILE', _default_env)
load_dotenv(dotenv_path=_env_file)
client_id = os.getenv("FYERS_CLIENT_ID")
secret_key = os.getenv("FYERS_SECRET_ID")
redirect_uri = os.getenv("FYERS_REDIRECT_URI")
access_token = os.getenv("FYERS_ACCESS_TOKEN")
grant_type = "authorization_code"

# HTTP Session with connection pooling and retries
def create_resilient_session():
    """Create HTTP session with automatic retries, timeouts, and connection pooling."""
    session = requests.Session()
    retry_strategy = Retry(
        total=3,
        status_forcelist=[429, 500, 502, 503, 504],
        backoff_factor=1,
        allowed_methods=["HEAD", "GET", "OPTIONS", "POST"]
    )
    adapter = HTTPAdapter(
        max_retries=retry_strategy,
        pool_connections=10,
        pool_maxsize=20,
        pool_block=False
    )
    session.mount("http://", adapter)
    session.mount("https://", adapter)
    return session

http_session = create_resilient_session()

# Thread pool for blocking operations
executor = ThreadPoolExecutor(max_workers=5, thread_name_prefix="FyersWorker")

# Global variables
clients = {}
symbol_to_clients = {}
active_subscriptions = set()
running = True
historical_data = {}
ohlc_data = {}
real_time_data = {}
chart_updates = {}
pending_data = {}
# Track last seen vol_traded_today per symbol to compute per-tick delta volume
prev_vol_traded_today = {}
MAX_HISTORY_POINTS = 10000
MAX_COMPANIES = 6
INDIA_TZ = pytz.timezone('Asia/Kolkata')
fyers = None
fyers_client = None
available_symbols = []
last_tick = {}
auth_initialized = False
symbol_subscriptions = defaultdict(int)
cached_indicators = {}
last_emit_time = defaultdict(float)
last_cleanup_time = time.time()
DATA_RETENTION_HOURS = 24
data_cleanup_interval = 3600
MAX_CHART_UPDATES = 5000

REAL_TIME_INTERVAL = 0.2
CHART_UPDATE_INTERVAL = 0.1

MONITORED_FIELDS = [
    'ltp', 'vol_traded_today', 'last_traded_time', 'bid_size', 'ask_size',
    'bid_price', 'ask_price', 'low_price', 'high_price', 'open_price', 'prev_close_price'
]


def extract_jwt_token(full_token):
    """Extract JWT token from full token string."""
    if ':' in full_token:
        return full_token.split(':', 1)[1]
    else:
        return full_token


def load_available_symbols():
    """Load available symbols from watchlist A - optional, fallback to empty."""
    global available_symbols
    try:
        csv_path = os.path.join(os.path.dirname(__file__), 'data', 'watchlists', 'watchlist_A_2025-02-16.csv')
        
        # Try alternative paths if main path doesn't exist
        if not os.path.exists(csv_path):
            csv_path = 'apps/backend/data/watchlists/watchlist_A_2025-02-16.csv'
        
        if not os.path.exists(csv_path):
            csv_path = 'data/watchlists/watchlist_A_2025-02-16.csv'
        
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
        # No fallback symbols - completely empty
        available_symbols = []
        logger.info("Operating in fully dynamic mode - no predefined symbols")
        return True


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
    if now.weekday() >= 5:  # Saturday or Sunday
        return False
    return start_time <= now <= end_time


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


def initialize_fyers():
    """Initialize Fyers client and WebSocket with auto authentication."""
    global fyers_client, fyers, auth_initialized
    
    auth_file_path = os.path.join('data', 'fyers_data_auth.json')
    
    try:
        if not os.path.exists(auth_file_path):
            logger.info("ℹ️ No auth file found")
            return False
        
        # Check if file is empty or invalid
        file_size = os.path.getsize(auth_file_path)
        if file_size == 0:
            logger.warning("⚠️ Auth file is empty")
            return False
        
        with open(auth_file_path, 'r') as f:
            content = f.read().strip()
            if not content:
                logger.warning("⚠️ Auth file has no content")
                return False
            auth_data = json.loads(content)
        
        full_access_token = auth_data.get('access_token')
        if not full_access_token:
            logger.warning("⚠️ No access token found in auth file")
            return False
        
        jwt_token = extract_jwt_token(full_access_token)
        logger.info(f"🔍 JWT token: {jwt_token[:30]}...")
        logger.info(f"🔍 Full token: {full_access_token[:30]}...")
        
        # Initialize REST API client
        try:
            fyers_client = fyersModel.FyersModel(
                client_id=client_id,
                token=jwt_token,
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
        
        # Initialize WebSocket client
        try:
            ws_token = full_access_token if ':' in full_access_token else f"{client_id}:{jwt_token}"
            
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
            logger.info("✅ WebSocket client initialized")
            
        except Exception as e:
            logger.error(f"❌ WebSocket initialization error: {e}")
            fyers = None
        
        auth_initialized = True
        return True
        
    except json.JSONDecodeError as e:
        logger.error(f"❌ Invalid JSON in auth file: {e}")
        return False
    except Exception as e:
        logger.error(f"❌ Error loading auth: {e}")
        return False


def auth_watcher():
    """Watch auth file for updates and reinitialize when needed."""
    global running, auth_initialized, fyers
    auth_file_path = os.path.join('data', 'fyers_data_auth.json')
    last_modified = 0
    
    while running:
        try:
            if os.path.exists(auth_file_path):
                current_modified = os.path.getmtime(auth_file_path)
                if current_modified > last_modified or not auth_initialized:
                    if not auth_initialized or current_modified > last_modified:
                        logger.info("🔄 Auth file updated, reinitializing...")
                        if initialize_fyers() and fyers:
                            try:
                                ws_thread = threading.Thread(target=lambda: fyers.connect(), daemon=True)
                                ws_thread.start()
                                logger.info("✅ WebSocket connection started")
                                
                                # Resubscribe to all active symbols
                                if active_subscriptions and hasattr(fyers, 'subscribe'):
                                    symbols_list = list(active_subscriptions)
                                    fyers.subscribe(symbols=symbols_list, data_type="SymbolUpdate")
                                    logger.info(f"✅ Resubscribed to {len(symbols_list)} symbols")
                            except Exception as e:
                                logger.error(f"❌ WebSocket start error: {e}")
                    last_modified = current_modified
            time.sleep(5)
        except Exception as e:
            logger.error(f"❌ Auth watcher error: {e}")
            time.sleep(10)


@sio.event
async def connect(sid, environ):
    """Handle client connection."""
    logger.info(f"Client connected: {sid}")
    clients[sid] = {
        'subscriptions': set(),
        'connected_at': datetime.datetime.now(INDIA_TZ),
        'last_activity': datetime.datetime.now(INDIA_TZ)
    }
    
    # Send available symbols to client (may be empty initially)
    await sio.emit('availableSymbols', {
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
async def disconnect(sid):
    """Handle client disconnection."""
    logger.info(f"Client disconnected: {sid}")
    if sid in clients:
        # Clean up subscriptions
        for symbol in clients[sid]['subscriptions']:
            if symbol in symbol_to_clients:
                symbol_to_clients[symbol].discard(sid)
                
                # If no more clients for this symbol, unsubscribe from Fyers
                if not symbol_to_clients[symbol]:
                    active_subscriptions.discard(symbol)
                    symbol_subscriptions[symbol] = max(0, symbol_subscriptions[symbol] - 1)
                    logger.info(f"Removed {symbol} from active subscriptions")
        
        del clients[sid]
    
    # Update Fyers subscription if needed
    await update_fyers_subscription()


@sio.event
async def subscribe_companies(sid, data):
    """Subscribe to selected companies with enhanced validation and multi-view support."""
    try:
        logger.info(f"📡 Received subscription request from {sid}: {data}")
        
        # Extract companyCodes from data
        company_codes = data.get('companyCodes', [])
        logger.info(f"📡 Raw company codes: {company_codes}")
        
        # Validate data structure
        if not isinstance(company_codes, list):
            logger.error(f"❌ Invalid data type for companyCodes: {type(company_codes)}")
            await sio.emit('error', {'message': 'companyCodes must be an array'}, room=sid)
            return
        
        # Simplified validation - accept any non-empty string
        valid_company_codes = []
        for code in company_codes:
            if isinstance(code, str) and code.strip():
                valid_company_codes.append(code.strip().upper())
            else:
                logger.warning(f"⚠️ Skipping invalid company code: {code}")
        
        logger.info(f"✅ Valid company codes after filtering: {valid_company_codes}")
        
        # Check limits
        if len(valid_company_codes) > MAX_COMPANIES:
            logger.error(f"❌ Too many companies requested: {len(valid_company_codes)}")
            await sio.emit('error', {'message': f'Maximum {MAX_COMPANIES} companies allowed'}, room=sid)
            return
        
        if len(valid_company_codes) == 0:
            logger.error(f"❌ No valid company codes provided")
            await sio.emit('error', {'message': 'At least 1 valid company code must be provided'}, room=sid)
            return
        
        # Clear existing subscriptions for this client
        if sid in clients:
            for symbol in clients[sid]['subscriptions']:
                if symbol in symbol_to_clients:
                    symbol_to_clients[symbol].discard(sid)
                    if not symbol_to_clients[symbol]:
                        active_subscriptions.discard(symbol)
                        symbol_subscriptions[symbol] = max(0, symbol_subscriptions[symbol] - 1)
            clients[sid]['subscriptions'].clear()
        
        # Process valid company codes and create symbols
        requested_symbols = []
        for company_code in valid_company_codes:
            logger.info(f"📡 Processing company code: {company_code}")
            
            # Try to find in existing available symbols
            symbol_data = next(
                (s for s in available_symbols if s['company_code'] == company_code),
                None
            )
            
            if symbol_data:
                requested_symbols.append(symbol_data['symbol'])
                logger.info(f"✅ Found existing symbol for {company_code}: {symbol_data['symbol']}")
            else:
                # Dynamically create symbol
                new_symbol_data = add_symbol_to_available(company_code)
                requested_symbols.append(new_symbol_data['symbol'])
                logger.info(f"✅ Dynamically created symbol for {company_code}: {new_symbol_data['symbol']}")
        
        logger.info(f"📡 Final requested symbols: {requested_symbols}")
        
        # Update client subscriptions
        if sid not in clients:
            clients[sid] = {
                'subscriptions': set(),
                'connected_at': datetime.datetime.now(INDIA_TZ),
                'last_activity': datetime.datetime.now(INDIA_TZ)
            }
        
        # Add symbols to client subscriptions
        for symbol in requested_symbols:
            clients[sid]['subscriptions'].add(symbol)
            
            # Add to symbol_to_clients mapping
            if symbol not in symbol_to_clients:
                symbol_to_clients[symbol] = set()
            symbol_to_clients[symbol].add(sid)
            
            # Add to active subscriptions
            active_subscriptions.add(symbol)
            symbol_subscriptions[symbol] += 1
            logger.info(f"✅ Added {symbol} to active subscriptions")
        
        # Update Fyers subscription
        await update_fyers_subscription()
        
        # Send historical data for each symbol in background
        asyncio.create_task(send_batch_historical_data(sid, requested_symbols))
        
        # Send subscription confirmation
        await sio.emit('subscriptionConfirm', {
            'success': True,
            'symbols': requested_symbols,
            'count': len(requested_symbols)
        }, room=sid)
        
        logger.info(f"✅ Successfully subscribed client {sid} to {len(requested_symbols)} symbols")
        
    except Exception as e:
        logger.error(f"❌ Error in subscribe_companies: {e}")
        import traceback
        traceback.print_exc()
        await sio.emit('error', {'message': f'Subscription failed: {str(e)}'}, room=sid)


@sio.event
async def unsubscribe_all(sid, data):
    """Unsubscribe from all companies."""
    try:
        logger.info(f"📡 Unsubscribing all for client {sid}")
        
        if sid in clients:
            for symbol in clients[sid]['subscriptions']:
                if symbol in symbol_to_clients:
                    symbol_to_clients[symbol].discard(sid)
                    if not symbol_to_clients[symbol]:
                        active_subscriptions.discard(symbol)
                        symbol_subscriptions[symbol] = max(0, symbol_subscriptions[symbol] - 1)
            
            clients[sid]['subscriptions'].clear()
        
        await update_fyers_subscription()
        
        await sio.emit('subscriptionConfirm', {
            'success': True,
            'symbols': [],
            'count': 0
        }, room=sid)
        
        logger.info(f"✅ Client {sid} unsubscribed from all symbols")
        
    except Exception as e:
        logger.error(f"❌ Error in unsubscribe_all: {e}")
        await sio.emit('error', {'message': f'Unsubscription failed: {str(e)}'}, room=sid)


@sio.event
async def get_market_status(sid, data):
    """Get current market status."""
    try:
        start_time, end_time = get_trading_hours()
        await sio.emit('marketStatus', {
            'trading_active': is_trading_hours(),
            'trading_start': start_time.isoformat(),
            'trading_end': end_time.isoformat(),
            'current_time': datetime.datetime.now(INDIA_TZ).isoformat(),
            'is_market_day': datetime.datetime.now(INDIA_TZ).weekday() < 5,
            'active_subscriptions': len(active_subscriptions),
            'connected_clients': len(clients),
            'auth_status': auth_initialized
        }, room=sid)
    except Exception as e:
        logger.error(f"❌ Error in get_market_status: {e}")
        await sio.emit('error', {'message': f'Failed to get market status: {str(e)}'}, room=sid)


async def update_fyers_subscription():
    """Update Fyers WebSocket subscription based on active subscriptions."""
    if not fyers:
        logger.warning("Fyers not initialized, cannot update subscription")
        return
    
    try:
        current_symbols = list(active_subscriptions)
        if current_symbols:
            logger.info(f"🔄 Updating Fyers subscription with {len(current_symbols)} symbols")
            loop = asyncio.get_event_loop()
            await loop.run_in_executor(executor, fyers.subscribe, current_symbols, "SymbolUpdate")
            logger.info(f"✅ Updated Fyers subscription: {current_symbols}")
        else:
            logger.info("📡 No active subscriptions, keeping minimal connection")
    except Exception as e:
        logger.error(f"❌ Error updating Fyers subscription: {e}")


def fetch_historical_intraday_data(symbol, date=None):
    """Fetch historical intraday data for a symbol on demand (blocking function)."""
    if not date:
        date = datetime.datetime.now(INDIA_TZ).strftime('%Y-%m-%d')
    
    try:
        if not fyers_client or not auth_initialized:
            logger.warning(f"Fyers client not initialized for {symbol}")
            return []
        
        date_obj = datetime.datetime.strptime(date, '%Y-%m-%d')
        date_obj = INDIA_TZ.localize(date_obj)
        
        market_open = date_obj.replace(hour=9, minute=15, second=0, microsecond=0)
        market_close = date_obj.replace(hour=15, minute=30, second=0, microsecond=0)
        
        now = datetime.datetime.now(INDIA_TZ)
        if date == now.strftime('%Y-%m-%d') and now < market_open:
            logger.info(f"Market not yet open for {date}")
            return []
        
        end_time = min(now, market_close) if date == now.strftime('%Y-%m-%d') else market_close
        
        from_date = market_open.strftime('%Y-%m-%d %H:%M:%S')
        to_date = end_time.strftime('%Y-%m-%d %H:%M:%S')
        
        logger.info(f"📊 Fetching historical data for {symbol} from {from_date} to {to_date}")
        
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
            candles = response['candles']
            logger.info(f"✅ Received {len(candles)} candles for {symbol}")
            
            result = []
            
            for candle in candles:
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
                    'timestamp': timestamp,
                    'change': 0,
                    'changePercent': 0
                }
                
                result.append(data_point)
            
            # Calculate change and change percent
            if result:
                prev_close = result[0]['open']
                for point in result:
                    point['change'] = point['ltp'] - prev_close
                    point['changePercent'] = (point['change'] / prev_close) * 100 if prev_close else 0
            
            return result
        else:
            error_msg = response.get('message', 'Unknown error') if response else 'No response'
            error_code = response.get('code') if response else 'No code'
            logger.error(f"❌ API error for {symbol}: Code={error_code}, Message={error_msg}")
        
        return []
        
    except Exception as e:
        logger.error(f"❌ Error fetching historical data for {symbol}: {e}")
        import traceback
        traceback.print_exc()
        return []


async def send_batch_historical_data(sid, symbols):
    """Emit data for all symbols and manage background collection without blocking main thread."""
    try:
        for symbol in symbols:
            try:
                # Check if data already exists
                if symbol not in historical_data or len(historical_data[symbol]) == 0:
                    # Fetch with timeout
                    loop = asyncio.get_event_loop()
                    
                    future = loop.run_in_executor(
                        executor,
                        fetch_historical_intraday_data,
                        symbol,
                        None
                    )
                    
                    # 10 second timeout per symbol
                    hist_data = await asyncio.wait_for(future, timeout=10.0)
                    
                    if symbol not in historical_data:
                        historical_data[symbol] = deque(maxlen=MAX_HISTORY_POINTS)
                    
                    for data_point in hist_data:
                        historical_data[symbol].append(data_point)
                
                # Emit data if available
                if symbol in historical_data and len(historical_data[symbol]) > 0:
                    hist_data_list = list(historical_data[symbol])
                    await sio.emit('historicalData', {
                        'symbol': symbol,
                        'data': hist_data_list
                    }, room=sid)
                
                # Small delay to prevent socket flooding
                await asyncio.sleep(0.05)
                
            except asyncio.TimeoutError:
                logger.warning(f"Timeout fetching historical data for {symbol}")
            except Exception as e:
                logger.error(f"Error sending historical data for {symbol}: {e}")
        
        logger.info(f"Background data collection for {len(symbols)} symbols")
        
    except Exception as e:
        logger.error(f"Critical error in send_batch_historical_data: {e}")


def onmessage(message):
    """Handle incoming Fyers WebSocket messages."""
    try:
        # Handle subscription errors from Fyers (code -300 for invalid symbols)
        if isinstance(message, dict) and (message.get('code') == -300 or 'invalid_symbols' in message):
            logger.error(f"🚫 Fyers subscription error: {message}")
            error_data = {
                'code': message.get('code', -300),
                'message': message.get('message', 'Invalid symbol subscription failed'),
                'type': message.get('type', 'sub'),
                'invalid_symbols': message.get('invalid_symbols', [])
            }
            sio.emit_to_all('subscriptionError', error_data)
            sio.emit_to_all('fyersError', error_data)
            return
        
        # Skip system messages
        if isinstance(message, dict) and message.get('type') == 'sub':
            logger.info(f"📡 Subscription confirmation: {message}")
            return
        
        if isinstance(message, dict) and message.get('type') in ['cn', 'ful']:
            logger.info(f"📡 Connection message: {message}")
            return
        
        # Process market data
        if isinstance(message, dict) and 'symbol' in message:
            symbol = message['symbol']
            
            # Only process if symbol is actively subscribed
            if symbol not in active_subscriptions:
                return
            
            current_time = message.get('last_traded_time') or int(time.time())
            
            # Prepare enhanced market data
            simplified_data = {
                'symbol': symbol,
                'ltp': float(message.get('ltp', 0)),
                'change': float(message.get('ch', 0)),
                'changePercent': float(message.get('chp', 0)),
                'open': float(message.get('open_price', 0)),
                'high': float(message.get('high_price', 0)),
                'low': float(message.get('low_price', 0)),
                'close': float(message.get('prev_close_price', 0)),
                'volume': int(message.get('vol_traded_today', 0)),
                'bid': float(message.get('bid_price', 0)),
                'ask': float(message.get('ask_price', 0)),
                'timestamp': current_time
            }
            
            # Store real-time data
            real_time_data[symbol] = simplified_data
            pending_data[symbol] = simplified_data
            
            # Store historical data
            if symbol not in historical_data:
                historical_data[symbol] = deque(maxlen=MAX_HISTORY_POINTS)
            
            historical_data[symbol].append(simplified_data)
            
            # Store OHLC data — compute delta volume from cumulative vol_traded_today
            if symbol not in ohlc_data:
                ohlc_data[symbol] = deque(maxlen=MAX_HISTORY_POINTS)

            cumulative_vol = simplified_data['volume']  # vol_traded_today (cumulative)
            prev_vol = prev_vol_traded_today.get(symbol)
            if prev_vol is None:
                delta_vol = 0  # First tick — no reference yet
            else:
                delta_vol = max(0, cumulative_vol - prev_vol)
            prev_vol_traded_today[symbol] = cumulative_vol

            minute_timestamp = (current_time // 60) * 60
            if not ohlc_data[symbol] or ohlc_data[symbol][-1]['timestamp'] != minute_timestamp:
                ohlc_data[symbol].append({
                    'timestamp': minute_timestamp,
                    'open': simplified_data['ltp'],
                    'high': simplified_data['ltp'],
                    'low': simplified_data['ltp'],
                    'close': simplified_data['ltp'],
                    'volume': delta_vol
                })
            else:
                current_candle = ohlc_data[symbol][-1]
                current_candle['high'] = max(current_candle['high'], simplified_data['ltp'])
                current_candle['low'] = min(current_candle['low'], simplified_data['ltp'])
                current_candle['close'] = simplified_data['ltp']
                current_candle['volume'] += delta_vol
            
            # Save to file if needed
            save_to_file(symbol, simplified_data)
            
            logger.debug(f"📈 Processed market data for {symbol}: LTP={simplified_data['ltp']}")
            
    except Exception as e:
        logger.error(f"❌ Error processing message: {e}")
        import traceback
        traceback.print_exc()


def save_to_file(symbol, data):
    """Save market data to daily files."""
    try:
        exchange, company_code = safe_symbol_parse(symbol)
        
        if exchange and company_code:
            now = datetime.datetime.now(INDIA_TZ)
            folder = f"LD_{now.strftime('%d-%m-%Y')}"
            os.makedirs(folder, exist_ok=True)
            file_name = f"{company_code}-{exchange}.json"
            file_path = os.path.join(folder, file_name)
            
            with open(file_path, 'a') as f:
                json.dump(data, f)
                f.write('\n')
                
    except Exception as e:
        logger.error(f"❌ Error saving to file: {e}")


def onopen():
    """Handle Fyers WebSocket connection opening."""
    logger.info("✅ Fyers WebSocket connected")
    sio.emit('fyersConnected', {'status': 'connected'})
    
    # Subscribe to active symbols if any
    if active_subscriptions and fyers and hasattr(fyers, 'subscribe'):
        try:
            symbols_list = list(active_subscriptions)
            fyers.subscribe(symbols=symbols_list, data_type="SymbolUpdate")
            logger.info(f"📡 Subscribed to {len(symbols_list)} symbols on reconnection")
        except Exception as e:
            logger.error(f"❌ Error subscribing on open: {e}")


def onerror(error):
    """Handle Fyers WebSocket errors."""
    logger.error(f"❌ Fyers WebSocket Error: {error}")
    
    # Parse error for subscription failures
    error_str = str(error)
    error_data = {'message': error_str}
    
    # Check if this is a subscription error with invalid symbols
    if 'invalid_symbols' in error_str or '-300' in error_str or 'STOPPED' in error_str:
        try:
            import re
            # Extract invalid symbols from error message
            invalid_match = re.search(r"invalid_symbols['\"]?\s*:\s*\[([^\]]+)\]", error_str)
            if invalid_match:
                invalid_str = invalid_match.group(1)
                invalid_symbols = [s.strip().strip("'\"") for s in invalid_str.split(',')]
                error_data['invalid_symbols'] = invalid_symbols
                error_data['code'] = -300
                error_data['type'] = 'sub'
                logger.error(f"🚫 Parsed subscription error - Invalid symbols: {invalid_symbols}")
        except Exception as parse_error:
            logger.error(f"Error parsing subscription error: {parse_error}")
    
    sio.emit('error', error_data)
    sio.emit('subscriptionError', error_data)
    sio.emit('fyersError', error_data)


def onclose(message):
    """Handle Fyers WebSocket connection closure."""
    logger.info(f"❌ Fyers WebSocket Connection closed: {message}")
    sio.emit('fyersDisconnected', {'message': str(message)})


async def heartbeat_task():
    """Send periodic heartbeat to clients."""
    global running
    while running:
        try:
            heartbeat_data = {
                'timestamp': int(time.time()),
                'trading_active': is_trading_hours(),
                'active_subscriptions': len(active_subscriptions),
                'connected_clients': len(clients),
                'server_status': 'healthy',
                'auth_status': auth_initialized
            }
            await sio.emit('heartbeat', heartbeat_data)
            await asyncio.sleep(30)  # Send heartbeat every 30 seconds
        except Exception as e:
            logger.error(f"❌ Error in heartbeat: {e}")
            await asyncio.sleep(30)


async def emit_real_time_data():
    """Emit real-time data to subscribed clients for multi-view support (5010 specific)."""
    global running, last_cleanup_time
    while running:
        try:
            current_time = time.time()
            cutoff_time = current_time - (DATA_RETENTION_HOURS * 3600)
            
            # Periodic cleanup of old data
            if current_time - last_cleanup_time >= data_cleanup_interval:
                await cleanup_old_data()
                last_cleanup_time = current_time
            
            # Emit pending data to subscribed clients
            for symbol in list(pending_data.keys()):
                if symbol in pending_data and symbol in symbol_to_clients:
                    data = pending_data[symbol].copy()
                    
                    if current_time - last_emit_time[symbol] >= REAL_TIME_INTERVAL:
                        for sid in list(symbol_to_clients[symbol]):
                            try:
                                await sio.emit('marketData', data, room=sid)
                                
                                # Also emit chart update
                                chart_update = {
                                    'symbol': symbol,
                                    'price': data['ltp'],
                                    'timestamp': data['timestamp'],
                                    'volume': data.get('volume', 0),
                                    'change': data.get('change', 0),
                                    'changePercent': data.get('changePercent', 0)
                                }
                                await sio.emit('chartUpdate', chart_update, room=sid)
                                
                            except Exception as e:
                                logger.error(f"❌ Error sending data to client {sid}: {e}")
                        
                        last_emit_time[symbol] = current_time
            
            await asyncio.sleep(CHART_UPDATE_INTERVAL)
            
        except Exception as e:
            logger.error(f"❌ Error in emit_real_time_data: {e}")
            await asyncio.sleep(0.1)


async def cleanup_old_data():
    """Remove data older than DATA_RETENTION_HOURS (multi-view specific)."""
    try:
        current_time = time.time()
        cutoff_time = current_time - (DATA_RETENTION_HOURS * 3600)
        
        logger.info("Starting data cleanup for 5010 multi-view...")
        cleaned_count = 0
        
        for symbol in list(historical_data.keys()):
            if symbol in historical_data:
                recent_data = deque(maxlen=MAX_HISTORY_POINTS)
                for point in historical_data[symbol]:
                    if point.get('timestamp', 0) > cutoff_time:
                        recent_data.append(point)
                
                if len(recent_data) > 0:
                    historical_data[symbol] = recent_data
                elif symbol_subscriptions[symbol] == 0:
                    del historical_data[symbol]
                    cleaned_count += 1
            
            if symbol in ohlc_data:
                recent_ohlc = deque(maxlen=MAX_HISTORY_POINTS)
                for candle in ohlc_data[symbol]:
                    if candle.get('timestamp', 0) > cutoff_time:
                        recent_ohlc.append(candle)
                
                if len(recent_ohlc) > 0:
                    ohlc_data[symbol] = recent_ohlc
                elif symbol_subscriptions[symbol] == 0 and symbol in ohlc_data:
                    del ohlc_data[symbol]
        
        logger.info(f"Data cleanup completed. Cleaned {cleaned_count} old symbols.")
    except Exception as e:
        logger.error(f"❌ Error in cleanup_old_data: {e}")


async def auth_watcher():
    """Watch auth file for updates and reinitialize when needed."""
    global running, auth_initialized, fyers
    auth_file_path = os.path.join('data', 'fyers_data_auth.json')
    last_modified = 0
    
    while running:
        try:
            if os.path.exists(auth_file_path):
                current_modified = os.path.getmtime(auth_file_path)
                if current_modified > last_modified or not auth_initialized:
                    if not auth_initialized or current_modified > last_modified:
                        logger.info("🔄 Auth file updated, reinitializing...")
                        if initialize_fyers() and fyers:
                            try:
                                # Start WebSocket in asyncio executor
                                loop = asyncio.get_event_loop()
                                loop.run_in_executor(executor, fyers.connect)
                                logger.info("✅ WebSocket connection started")
                                
                                # Resubscribe to all active symbols
                                if active_subscriptions and hasattr(fyers, 'subscribe'):
                                    symbols_list = list(active_subscriptions)
                                    await loop.run_in_executor(executor, fyers.subscribe, symbols_list, "SymbolUpdate")
                                    logger.info(f"✅ Resubscribed to {len(symbols_list)} symbols")
                            except Exception as e:
                                logger.error(f"❌ WebSocket start error: {e}")
                    last_modified = current_modified
            await asyncio.sleep(5)
        except Exception as e:
            logger.error(f"❌ Auth watcher error: {e}")
            await asyncio.sleep(10)


async def main_async():
    """Main async process to start background tasks and server."""
    global fyers, fyers_client, running
    
    # Load available symbols (optional)
    load_available_symbols()
    
    logger.info("🚀 Backend initialized in dynamic mode - no preloading")
    
    try:
        # Create data directory
        os.makedirs('data', exist_ok=True)
        
        # Try initial authentication
        if initialize_fyers():
            logger.info("✅ Initial authentication successful")
            
            if fyers:
                loop = asyncio.get_event_loop()
                loop.run_in_executor(executor, fyers.connect)
                logger.info("✅ WebSocket connection started")
        else:
            logger.info("⚠️ Initial authentication failed, will retry when auth file updates")
        
        # Start background tasks
        await asyncio.gather(
            auth_watcher(),
            heartbeat_task(),
            emit_real_time_data(),
            return_exceptions=True
        )
        
    except Exception as e:
        logger.error(f"❌ Error in main_async: {e}")
        import traceback
        traceback.print_exc()


def main():
    """Main entry point - start uvicorn server."""
    global running
    
    logger.info("🚀 Starting Live Market Server 5010 (Multi-View) on port 5010...")
    logger.info("🔑 Using async socket.io with JWT token handling")
    logger.info("📡 Features: Multi-symbol, Multi-client, On-demand data fetching")
    
    # Configure uvicorn
    config = uvicorn.Config(
        app=app,
        host="0.0.0.0",
        port=5010,
        log_level="info",
        access_log=False
    )
    
    server = uvicorn.Server(config)
    
    try:
        # Create event loop
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        
        # Schedule background tasks
        loop.create_task(main_async())
        
        # Run server
        loop.run_until_complete(server.serve())
        
    except KeyboardInterrupt:
        logger.info("🛑 Shutting down...")
        running = False
    except Exception as e:
        logger.error(f"❌ Fatal error: {e}")
        running = False
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        logger.info("🛑 Shutting down...")
        running = False
