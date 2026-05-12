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
import requests
import threading
from collections import deque, defaultdict
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FuturesTimeoutError
from fyers_apiv3 import fyersModel
from fyers_apiv3.FyersWebsocket import data_ws
from typing import Dict, Set
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
import uvicorn
import urllib.parse


# Logging Configuration
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[logging.StreamHandler(sys.stdout)]
)
logger = logging.getLogger("FyersServer")


# Socket.IO AsyncServer
sio = socketio.AsyncServer(
    async_mode='asgi',
    cors_allowed_origins='*',
    logger=False,
    engineio_logger=False,
    ping_timeout=60,  # Increased timeout
    ping_interval=25,  # More frequent pings
)
app = socketio.ASGIApp(sio)


# Environment Configuration
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
response_type = "code"
grant_type = "authorization_code"


# Global State
clients: Dict[str, dict] = {}
symbol_to_clients: Dict[str, Set[str]] = {}
running = True
auth_initialized = False
main_loop = None

# Subscription tracking with daily reset
SUBSCRIPTION_DATA_DIR = 'data'
last_subscription_date = None  # Track date for daily reset


# Multi-symbol persistent data storage
historical_data: Dict[str, deque] = {}
ohlc_data: Dict[str, deque] = {}
chart_updates: Dict[str, deque] = {}
active_symbols: Set[str] = set()
symbol_subscriptions = defaultdict(int)


MAX_HISTORY_POINTS = 50000
MAX_CHART_UPDATES = 5000
DATA_RETENTION_HOURS = 24


INDIA_TZ = pytz.timezone('Asia/Kolkata')


fyers = None
fyers_client = None


# Real-time Configuration
REAL_TIME_INTERVAL = 0.2
CHART_UPDATE_INTERVAL = 0.1
last_emit_time = defaultdict(float)
pending_data = {}

# ============ Fyers Subscribe Thread-Safety ============
# The Fyers SDK's internal symbol→token mapping is NOT thread-safe.
# fyers.subscribe() is called from multiple threads concurrently:
#   - onopen()            → Fyers WebSocket callback thread
#   - subscribe_companies() → ThreadPoolExecutor thread
#   - subscribe()         → ThreadPoolExecutor thread
#   - auth_watcher()      → asyncio event loop
# Concurrent calls corrupt the token mapping, causing tick data to arrive
# labeled with the WRONG symbol — the "data swapping" bug.
#
# Fix: serialize ALL fyers.subscribe() calls through a single threading.Lock
# and track already-subscribed symbols to avoid redundant re-subscription.
_fyers_subscribe_lock = threading.Lock()
_fyers_subscribed_symbols: Set[str] = set()  # cleared on WebSocket disconnect


def fyers_subscribe_safe(symbols: list, data_type: str = "SymbolUpdate") -> None:
    """
    Thread-safe, dedup-aware wrapper for fyers.subscribe().

    Guarantees:
    - Only ONE call to fyers.subscribe() executes at any moment (lock).
    - Symbols already submitted to Fyers in this session are skipped
      so we never trigger a redundant token-remap (dedup via _fyers_subscribed_symbols).
    - On WebSocket reconnect, onclose() clears _fyers_subscribed_symbols so
      all active symbols get re-submitted once and only once.
    """
    global fyers, _fyers_subscribed_symbols

    if not fyers or not hasattr(fyers, 'subscribe') or not callable(fyers.subscribe):
        return

    with _fyers_subscribe_lock:
        new_symbols = [s for s in symbols if s not in _fyers_subscribed_symbols]
        if not new_symbols:
            logger.debug(f"[fyers_subscribe_safe] All {len(symbols)} symbol(s) already subscribed — skipping.")
            return
        try:
            fyers.subscribe(symbols=new_symbols, data_type=data_type)
            _fyers_subscribed_symbols.update(new_symbols)
            logger.info(
                f"[fyers_subscribe_safe] ✅ Subscribed {len(new_symbols)} new symbol(s) "
                f"(total in-session: {len(_fyers_subscribed_symbols)})"
            )
        except Exception as e:
            logger.error(f"[fyers_subscribe_safe] ❌ fyers.subscribe() failed: {e}")


# Persistent data management
cached_indicators = {}
data_cleanup_interval = 3600
last_cleanup_time = time.time()


# HTTP Session with connection pooling and retries
def create_resilient_session():
    """
    Create HTTP session with automatic retries, timeouts, and connection pooling.
    """
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


# Global HTTP session for reuse
http_session = create_resilient_session()

# External Historical Data Server (port 6969)
EXTERNAL_DATA_SERVER = os.getenv('EXTERNAL_DATA_SERVER', 'http://100.93.172.21:6969')


# Thread pool for blocking operations
executor = ThreadPoolExecutor(max_workers=5, thread_name_prefix="FyersWorker")


# ============================================================================
# PERMANENT BLACKLIST (does NOT reset daily)
# ============================================================================
# This file contains symbols that are permanently stopped/invalid
# and should never be subscribed to. It does NOT reset with daily reset.
PERMANENT_BLACKLIST_FILE = os.path.join(SUBSCRIPTION_DATA_DIR, 'permanently_stopped.json')

# Set of permanently stopped symbols (loaded at startup)
permanently_stopped_symbols: Set[str] = set()


def load_permanent_blacklist():
    """Load the permanent blacklist from file."""
    global permanently_stopped_symbols
    
    if os.path.exists(PERMANENT_BLACKLIST_FILE):
        try:
            with open(PERMANENT_BLACKLIST_FILE, 'r') as f:
                content = f.read().strip()
                if content:
                    data = json.loads(content)
                    permanently_stopped_symbols = set(data)
                    logger.info(f"📋 Loaded {len(permanently_stopped_symbols)} permanently stopped symbols")
        except Exception as e:
            logger.error(f"Error loading permanent blacklist: {e}")
    else:
        logger.info("📋 No permanent blacklist file found, starting fresh")


def add_to_permanent_blacklist(symbols: list):
    """Add symbols to the permanent blacklist (persists across restarts and daily resets)."""
    global permanently_stopped_symbols
    
    if not symbols:
        return
    
    # Add to in-memory set
    for symbol in symbols:
        permanently_stopped_symbols.add(symbol)
    
    # Save to file
    try:
        with open(PERMANENT_BLACKLIST_FILE, 'w') as f:
            json.dump(list(permanently_stopped_symbols), f, indent=2)
        logger.info(f"📋 Added {len(symbols)} to permanent blacklist (total: {len(permanently_stopped_symbols)})")
    except Exception as e:
        logger.error(f"❌ Failed to save permanent blacklist: {e}")


def is_permanently_stopped(symbol: str) -> bool:
    """Check if a symbol is in the permanent blacklist."""
    # Check exact match
    if symbol in permanently_stopped_symbols:
        return True
    
    # Extract company code from symbol (e.g., NSE:ACLGATI-EQ -> ACLGATI)
    try:
        if ':' in symbol and '-' in symbol:
            code = symbol.split(':')[1].split('-')[0]
            # Check if any blacklisted symbol contains this code
            for stopped in permanently_stopped_symbols:
                if code in stopped:
                    return True
    except:
        pass
    
    return False


# ============================================================================
# SUBSCRIPTION FILE MANAGEMENT (with daily reset)
# ============================================================================

def get_today_date_str():
    """Get today's date in IST as string."""
    return datetime.datetime.now(INDIA_TZ).strftime('%Y-%m-%d')


def check_and_reset_subscription_files():
    """
    Check if date has changed and reset all subscription files if needed.
    Returns True if files were reset.
    """
    global last_subscription_date
    
    today = get_today_date_str()
    
    # Check if we need to reset
    date_file = os.path.join(SUBSCRIPTION_DATA_DIR, 'subscription_date.txt')
    
    stored_date = None
    if os.path.exists(date_file):
        try:
            with open(date_file, 'r') as f:
                stored_date = f.read().strip()
        except:
            pass
    
    if stored_date != today:
        logger.info(f"📅 New day detected ({stored_date} -> {today}). Resetting subscription files...")
        
        # Reset all three files
        files_to_reset = [
            'subscribed_companies.json',
            'failed_subscriptions.json',
            'stopped_companies.json'
        ]
        
        for filename in files_to_reset:
            filepath = os.path.join(SUBSCRIPTION_DATA_DIR, filename)
            try:
                with open(filepath, 'w') as f:
                    json.dump([], f)
                logger.info(f"  ✓ Reset {filename}")
            except Exception as e:
                logger.error(f"  ✗ Failed to reset {filename}: {e}")
        
        # Update stored date
        try:
            with open(date_file, 'w') as f:
                f.write(today)
        except Exception as e:
            logger.error(f"Failed to update date file: {e}")
        
        last_subscription_date = today
        return True
    
    last_subscription_date = today
    return False


def save_to_subscription_file(filename: str, symbols: list):
    """
    Save symbols to a subscription JSON file, merging with existing and deduplicating.
    """
    if not symbols:
        return
    
    filepath = os.path.join(SUBSCRIPTION_DATA_DIR, filename)
    
    try:
        # Read existing
        existing = []
        if os.path.exists(filepath):
            try:
                with open(filepath, 'r') as f:
                    content = f.read().strip()
                    if content:
                        existing = json.loads(content)
            except Exception as e:
                logger.error(f"Error reading {filename}: {e}")
                existing = []
        
        # Merge and deduplicate
        updated = list(set(existing + symbols))
        
        with open(filepath, 'w') as f:
            json.dump(updated, f, indent=2)
        
        logger.info(f"💾 Saved {len(symbols)} to {filename} (total: {len(updated)})")
        
    except Exception as e:
        logger.error(f"❌ Failed to save {filename}: {e}")


def load_subscription_file(filename: str) -> list:
    """Load symbols from a subscription JSON file."""
    filepath = os.path.join(SUBSCRIPTION_DATA_DIR, filename)
    
    if not os.path.exists(filepath):
        return []
    
    try:
        with open(filepath, 'r') as f:
            content = f.read().strip()
            if content:
                return json.loads(content)
    except Exception as e:
        logger.error(f"Error loading {filename}: {e}")
    
    return []


# Helper Functions
def extract_jwt_token(full_token):
    """Extract JWT token from full token string."""
    if ':' in full_token:
        return full_token.split(':', 1)[1]
    return full_token


def initialize_fyers():
    """Initialize Fyers client and WebSocket with auto authentication."""
    global fyers_client, fyers, auth_initialized
    
    auth_file_path = os.path.join('data', 'fyers_data_auth.json')
    
    try:
        if not os.path.exists(auth_file_path):
            logger.info("ℹ️ No auth file found")
            return False
        
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
        
        # Initialize REST API client
        try:
            fyers_client = fyersModel.FyersModel(
                client_id=client_id,
                token=jwt_token,
                log_path=None
            )
            
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
                                
                                # Resubscribe to all active symbols via thread-safe wrapper.
                                # Run in executor so we don't block the asyncio event loop.
                                if active_symbols:
                                    symbols_list = list(active_symbols)
                                    loop.run_in_executor(executor, fyers_subscribe_safe, symbols_list, "SymbolUpdate")
                                    logger.info(f"✅ Queued resubscription for {len(symbols_list)} symbols")
                            except Exception as e:
                                logger.error(f"❌ WebSocket start error: {e}")
                    last_modified = current_modified
            await asyncio.sleep(5)
        except Exception as e:
            logger.error(f"❌ Auth watcher error: {e}")
            await asyncio.sleep(10)


def cleanup_old_data():
    """Remove data older than DATA_RETENTION_HOURS"""
    global last_cleanup_time
    current_time = time.time()
    cutoff_time = current_time - (DATA_RETENTION_HOURS * 3600)

    if current_time - last_cleanup_time < data_cleanup_interval:
        return

    logger.info("Starting data cleanup...")
    cleaned_symbols = []

    for symbol in list(historical_data.keys()):
        if symbol in historical_data:
            recent_data = deque(maxlen=MAX_HISTORY_POINTS)
            for point in historical_data[symbol]:
                if point['timestamp'] > cutoff_time:
                    recent_data.append(point)

            if len(recent_data) > 0:
                historical_data[symbol] = recent_data
            else:
                if symbol_subscriptions[symbol] == 0:
                    del historical_data[symbol]
                    cleaned_symbols.append(symbol)

        if symbol in ohlc_data:
            recent_ohlc = deque(maxlen=MAX_HISTORY_POINTS)
            for candle in ohlc_data[symbol]:
                if candle['timestamp'] > cutoff_time:
                    recent_ohlc.append(candle)

            if len(recent_ohlc) > 0:
                ohlc_data[symbol] = recent_ohlc
            elif symbol_subscriptions[symbol] == 0:
                if symbol in ohlc_data:
                    del ohlc_data[symbol]

        if symbol in chart_updates:
            recent_updates = deque(maxlen=MAX_CHART_UPDATES)
            for update in chart_updates[symbol]:
                if update['timestamp'] > cutoff_time:
                    recent_updates.append(update)

            if len(recent_updates) > 0:
                chart_updates[symbol] = recent_updates
            elif symbol_subscriptions[symbol] == 0:
                if symbol in chart_updates:
                    del chart_updates[symbol]

    for symbol in cleaned_symbols:
        if symbol in cached_indicators:
            del cached_indicators[symbol]
        active_symbols.discard(symbol)

    last_cleanup_time = current_time
    logger.info(f"Data cleanup completed. Cleaned {len(cleaned_symbols)} old symbols.")


def get_trading_hours():
    now = datetime.datetime.now(INDIA_TZ)
    start_time = now.replace(hour=9, minute=15, second=0, microsecond=0)
    end_time = now.replace(hour=15, minute=30, second=0, microsecond=0)
    return start_time, end_time


def is_trading_hours():
    now = datetime.datetime.now(INDIA_TZ)
    start_time, end_time = get_trading_hours()

    if now.weekday() >= 5:
        return False

    return start_time <= now <= end_time


def is_after_market_hours():
    """Check if we're past market close but still on a trading day"""
    now = datetime.datetime.now(INDIA_TZ)
    start_time, end_time = get_trading_hours()
    
    # Weekend - no after-market
    if now.weekday() >= 5:
        return False
    
    # After 3:30 PM but before midnight - after market hours
    return now > end_time


def fetch_external_historical_data(symbol: str, date: str = None) -> list:
    """
    Fetch historical data from external server (port 6969) after market closes.
    This allows viewing full day's data when Fyers WebSocket is not active.
    
    Symbol format: NSE:AXISBANK-EQ -> AXISBANK-NSE
    Date format: YYYY-MM-DD -> DD-MM-YYYY for server
    """
    if not date:
        date = datetime.datetime.now(INDIA_TZ).strftime('%Y-%m-%d')
    
    try:
        # Convert symbol format: NSE:AXISBANK-EQ -> AXISBANK-NSE
        if ':' in symbol:
            parts = symbol.split(':')
            if len(parts) == 2:
                exchange = parts[0]
                code_part = parts[1]
                company_code = code_part.split('-')[0]
                external_symbol = f"{company_code}-{exchange}"
            else:
                external_symbol = symbol
        else:
            external_symbol = symbol
        
        # Convert date format: YYYY-MM-DD -> DD-MM-YYYY
        date_parts = date.split('-')
        if len(date_parts) == 3:
            formatted_date = f"{date_parts[2]}-{date_parts[1]}-{date_parts[0]}"
        else:
            formatted_date = date
        
        # Build URL for external server
        encoded_symbol = urllib.parse.quote(external_symbol)
        url = f"{EXTERNAL_DATA_SERVER}/Live/LD_{formatted_date}/{encoded_symbol}.json"
        
        logger.info(f"📡 Fetching after-market data from: {url}")
        
        response = http_session.get(url, timeout=30)
        
        if response.status_code != 200:
            logger.warning(f"External server returned {response.status_code} for {symbol}")
            return []
        
        # Parse line-by-line JSON (NDJSON format)
        lines = response.text.strip().split('\n')
        data_points = []
        
        for line in lines:
            if not line.strip():
                continue
            try:
                point = json.loads(line)
                
                timestamp = point.get('timestamp') or point.get('last_traded_time', 0)
                
                data_point = {
                    'symbol': symbol,
                    'ltp': point.get('ltp', 0),
                    'open': point.get('open_price', 0),
                    'high': point.get('high_price', 0),
                    'low': point.get('low_price', 0),
                    'close': point.get('ltp', 0),
                    'volume': point.get('vol_traded_today', 0),
                    'timestamp': timestamp,
                    'change': 0,
                    'changePercent': 0,
                    'bid': point.get('bid_price', 0),
                    'ask': point.get('ask_price', 0)
                }
                data_points.append(data_point)
                
            except json.JSONDecodeError:
                continue
        
        # Sort by timestamp
        data_points.sort(key=lambda x: x['timestamp'])
        
        # Calculate change and changePercent
        if data_points:
            prev_close = data_points[0].get('open', data_points[0]['ltp'])
            for point in data_points:
                point['change'] = point['ltp'] - prev_close
                point['changePercent'] = (point['change'] / prev_close * 100) if prev_close else 0
        
        logger.info(f"✅ Fetched {len(data_points)} after-market data points for {symbol}")
        return data_points
        
    except requests.exceptions.Timeout:
        logger.error(f"⏱️ Timeout fetching external data for {symbol}")
        return []
    except Exception as e:
        logger.error(f"❌ Error fetching external historical data for {symbol}: {e}")
        return []


def build_ohlc_from_external_data(symbol: str, data_points: list) -> list:
    """Build OHLC candles from external tick data.

    vol_traded_today is a CUMULATIVE daily total. We compute per-tick deltas by
    tracking prev_cumulative_vol across ALL ticks (not just within a minute).
    This correctly handles minutes with only a single tick, which the old
    per-minute _start_vol approach left with a huge cumulative value.
    """
    if not data_points:
        return []

    # Sort by timestamp so deltas are computed in chronological order
    sorted_points = sorted(data_points, key=lambda x: x['timestamp'])

    candles_by_minute = {}
    prev_cumulative_vol = None  # None = first tick, delta = 0

    for point in sorted_points:
        timestamp = point['timestamp']
        minute_ts = (timestamp // 60) * 60
        curr_vol = point.get('volume', 0) or 0

        # Delta volume for this tick
        if prev_cumulative_vol is None:
            # First tick ever – we don't know what came before, so set delta = 0
            delta = 0
        elif curr_vol >= prev_cumulative_vol:
            delta = curr_vol - prev_cumulative_vol
        else:
            # Cumulative reset (new day or data gap) – treat current as delta
            delta = curr_vol

        prev_cumulative_vol = curr_vol

        if minute_ts not in candles_by_minute:
            candles_by_minute[minute_ts] = {
                'timestamp': minute_ts,
                'open': point['ltp'],
                'high': point['ltp'],
                'low': point['ltp'],
                'close': point['ltp'],
                'volume': delta,  # Correct delta even for single-tick minutes
            }
        else:
            candle = candles_by_minute[minute_ts]
            candle['high'] = max(candle['high'], point['ltp'])
            candle['low'] = min(candle['low'], point['ltp'])
            candle['close'] = point['ltp']
            candle['volume'] += delta

    # Convert to sorted list
    candles = []
    for minute_ts in sorted(candles_by_minute.keys()):
        candle = candles_by_minute[minute_ts]
        candles.append({
            'timestamp': candle['timestamp'],
            'open': candle['open'],
            'high': candle['high'],
            'low': candle['low'],
            'close': candle['close'],
            'volume': max(0, candle['volume'])
        })

    return candles


# Socket.IO Event Handlers
@sio.event
async def connect(sid, environ):
    logger.info(f"Client connected: {sid}")
    clients[sid] = {'subscriptions': set(), 'last_ping': time.time()}
    
    await sio.emit('authStatus', {
        'authenticated': auth_initialized,
        'timestamp': int(time.time())
    }, room=sid)


@sio.event
async def disconnect(sid):
    logger.info(f"Client disconnected: {sid}")
    if sid in clients:
        for symbol in clients[sid]['subscriptions']:
            if symbol in symbol_to_clients:
                symbol_to_clients[symbol].discard(sid)
            symbol_subscriptions[symbol] = max(0, symbol_subscriptions[symbol] - 1)

            if symbol_subscriptions[symbol] == 0:
                logger.info(f"No more active clients for {symbol}, but keeping background collection")

        del clients[sid]


# Fetch historical data with timeout protection
def fetch_historical_intraday_data(symbol, date=None):
    """
    Fetch historical data with timeout and error handling.
    This is a BLOCKING function that should be called via executor.
    """
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

        if date == now.strftime('%Y-%m-%d') and now < market_close:
            end_time = now
        else:
            end_time = market_close

        from_date = market_open.strftime('%Y-%m-%d %H:%M:%S')
        to_date = end_time.strftime('%Y-%m-%d %H:%M:%S')

        logger.info(f"Fetching historical data for {symbol} from {from_date} to {to_date}")

        data_args = {
            "symbol": symbol,
            "resolution": "1",
            "date_format": "1",
            "range_from": from_date,
            "range_to": to_date,
            "cont_flag": "1"
        }

        # Add timeout to prevent hanging
        response = fyers_client.history(data_args)

        if response and response.get('s') == 'ok' and 'candles' in response:
            candles = response['candles']
            logger.info(f"Received {len(candles)} candles for {symbol}")

            result = []

            for candle in candles:
                timestamp, open_price, high_price, low_price, close_price, volume = candle

                if timestamp > 10000000000:
                    timestamp = timestamp // 1000

                data_point = {
                    'symbol': symbol,
                    'ltp': close_price,
                    'open': open_price,
                    'high': high_price,
                    'low': low_price,
                    'close': close_price,
                    'volume': volume,
                    'timestamp': timestamp,
                    'change': 0,
                    'changePercent': 0
                }

                result.append(data_point)

                if symbol not in ohlc_data:
                    ohlc_data[symbol] = deque(maxlen=MAX_HISTORY_POINTS)

                minute_timestamp = (timestamp // 60) * 60

                ohlc_candle = {
                    'timestamp': minute_timestamp,
                    'open': open_price,
                    'high': high_price,
                    'low': low_price,
                    'close': close_price,
                    'volume': volume
                }

                if not ohlc_data[symbol] or ohlc_data[symbol][-1]['timestamp'] != minute_timestamp:
                    ohlc_data[symbol].append(ohlc_candle)

            if result:
                prev_close = result[0]['open']
                for point in result:
                    point['change'] = point['ltp'] - prev_close
                    point['changePercent'] = (point['change'] / prev_close) * 100 if prev_close else 0

            if result:
                calculate_indicators_optimized(symbol, init=True)
                active_symbols.add(symbol)

            return result
        else:
            logger.error(f"Failed to fetch historical data: {response}")

        return []

    except requests.exceptions.Timeout:
        logger.error(f"⏱️ Timeout fetching historical data for {symbol}")
        return []
    except Exception as e:
        logger.error(f"Error fetching historical data for {symbol}: {e}")
        import traceback
        traceback.print_exc()
        return []


def fetch_daily_historical_data(symbol, days=30):
    """Fetch daily historical data with timeout."""
    try:
        if not fyers_client or not auth_initialized:
            logger.error("Fyers client not initialized")
            return []
        
        end_date = datetime.datetime.now(INDIA_TZ)
        start_date = end_date - datetime.timedelta(days=days)
        
        data_args = {
            "symbol": symbol,
            "resolution": "D",
            "date_format": "1",
            "range_from": start_date.strftime('%Y-%m-%d'),
            "range_to": end_date.strftime('%Y-%m-%d'),
            "cont_flag": "1"
        }
        
        # Should have timeout but fyers_client doesn't support it directly
        response = fyers_client.history(data_args)
        
        if response and response.get('s') == 'ok' and 'candles' in response:
            return response['candles']
        else:
            logger.error(f"Failed to fetch daily historical data: {response}")
            return []
            
    except Exception as e:
        logger.error(f"Error fetching daily historical data: {e}")
        return []


@sio.event
async def subscribe(sid, data):
    symbol = data.get('symbol')
    if not symbol:
        return {'success': False, 'error': 'No symbol provided'}
    
    # Check market status
    is_market_open = is_trading_hours()
    is_after_market = is_after_market_hours()
    
    # If market is closed and no auth, we can still serve data from external server
    if not auth_initialized and not is_after_market:
        return {'success': False, 'error': 'Authentication not initialized'}

    logger.info(f"Client {sid} subscribing to {symbol} (market_open={is_market_open}, after_market={is_after_market})")

    clients[sid]['subscriptions'].add(symbol)
    if symbol not in symbol_to_clients:
        symbol_to_clients[symbol] = set()
    symbol_to_clients[symbol].add(sid)

    symbol_subscriptions[symbol] += 1
    active_symbols.add(symbol)

    # Fetch historical data based on market status
    if symbol not in historical_data or not historical_data[symbol]:
        loop = asyncio.get_event_loop()
        
        try:
            # After market hours: Fetch from external server (port 6969)
            if is_after_market or not auth_initialized:
                logger.info(f"📡 After-market mode: Fetching from external server for {symbol}")
                
                external_data = await asyncio.wait_for(
                    loop.run_in_executor(executor, fetch_external_historical_data, symbol, None),
                    timeout=30.0
                )
                
                if external_data and len(external_data) > 0:
                    if symbol not in historical_data:
                        historical_data[symbol] = deque(maxlen=MAX_HISTORY_POINTS)
                    
                    for data_point in external_data:
                        historical_data[symbol].append(data_point)
                    
                    # Build OHLC candles
                    ohlc_candles = build_ohlc_from_external_data(symbol, external_data)
                    if symbol not in ohlc_data:
                        ohlc_data[symbol] = deque(maxlen=MAX_HISTORY_POINTS)
                    for candle in ohlc_candles:
                        ohlc_data[symbol].append(candle)
                    
                    logger.info(f"✅ Loaded {len(external_data)} points from external server for {symbol}")
            else:
                # Market open: Use Fyers API
                logger.info(f"Fetching fresh historical data from Fyers for {symbol}")
                
                hist_data = await asyncio.wait_for(
                    loop.run_in_executor(executor, fetch_historical_intraday_data, symbol, None),
                    timeout=10.0
                )

                if symbol not in historical_data:
                    historical_data[symbol] = deque(maxlen=MAX_HISTORY_POINTS)

                for data_point in hist_data:
                    historical_data[symbol].append(data_point)
                
        except asyncio.TimeoutError:
            logger.error(f"⏱️ Timeout fetching historical data for {symbol}")
        except Exception as e:
            logger.error(f"Error fetching historical data: {e}")
    else:
        logger.info(f"Using cached historical data for {symbol} ({len(historical_data[symbol])} points)")

    # Subscribe to real-time updates (only during market hours with auth)
    if is_market_open and auth_initialized:
        logger.info(f"Subscribing to real-time updates for: {symbol}")
        try:
            loop = asyncio.get_event_loop()
            await loop.run_in_executor(executor, fyers_subscribe_safe, [symbol], "SymbolUpdate")
        except Exception as e:
            logger.error(f"Error subscribing to {symbol}: {e}")

    # Send all available data to client
    if symbol in historical_data and historical_data[symbol]:
        logger.info(f"Sending {len(historical_data[symbol])} historical data points for {symbol}")
        hist_data_list = list(historical_data[symbol])
        await sio.emit('historicalData', {
            'symbol': symbol,
            'data': hist_data_list
        }, room=sid)

    if symbol in ohlc_data and ohlc_data[symbol]:
        logger.info(f"Sending {len(ohlc_data[symbol])} OHLC data points for {symbol}")
        # Clean OHLC data before sending (remove internal tracking fields)
        clean_ohlc = []
        for candle in ohlc_data[symbol]:
            clean_candle = {
                'timestamp': candle['timestamp'],
                'open': candle['open'],
                'high': candle['high'],
                'low': candle['low'],
                'close': candle['close'],
                'volume': candle['volume']
            }
            clean_ohlc.append(clean_candle)
        
        await sio.emit('ohlcData', {
            'symbol': symbol,
            'data': clean_ohlc
        }, room=sid)

    if symbol in chart_updates and chart_updates[symbol]:
        logger.info(f"Sending {len(chart_updates[symbol])} cached chart updates for {symbol}")
        await sio.emit('chartUpdatesHistory', {
            'symbol': symbol,
            'data': list(chart_updates[symbol])
        }, room=sid)

    return {'success': True, 'symbol': symbol, 'cached_points': len(historical_data.get(symbol, []))}


# Batch subscription endpoint with rate limiting
@sio.event
async def subscribe_companies(sid, data):
    """
    Batch subscribe to multiple company symbols with robust error handling and rate limiting.
    Handles three categories: subscribed (success), failed, stopped.
    Implements daily reset of subscription files.
    
    AFTER MARKET HOURS: Fetches data from external server (port 6969) instead of Fyers.
    """
    symbols = data.get('symbols', [])
    
    if not symbols:
        logger.warning(f"Client {sid} sent empty symbols list")
        return {'success': False, 'error': 'No symbols provided', 'count': 0}
    
    if sid not in clients:
        logger.error(f"Client {sid} not found in clients dict")
        return {'success': False, 'error': 'Client not registered', 'count': 0}
    
    # Check market status
    is_market_open = is_trading_hours()
    is_after_market = is_after_market_hours()
    
    # Allow subscription even without auth if market is closed (will fetch from external server)
    if not auth_initialized and is_market_open:
        logger.error(f"❌ Authentication not initialized - auth_initialized={auth_initialized}, fyers={fyers is not None}, fyers_client={fyers_client is not None}")
        logger.error(f"📁 Check if auth file exists at: {os.path.join('data', 'fyers_data_auth.json')}")
        
        # Try to reinitialize
        logger.info("🔄 Attempting to reinitialize authentication...")
        if initialize_fyers():
            logger.info("✅ Authentication reinitialized successfully")
        else:
            return {'success': False, 'error': 'Authentication not initialized. Please ensure Fyers auth token is configured in data/fyers_data_auth.json', 'count': 0}
    
    if is_after_market:
        logger.info(f"📴 After-market mode: Will fetch historical data from external server (port 6969)")
    
    # Check for daily reset of subscription files
    check_and_reset_subscription_files()
    
    logger.info(f"📥 Client {sid} subscribing to {len(symbols)} symbols (market_open={is_market_open}, after_market={is_after_market})")
    
    # Categorize symbols
    stopped_symbols = []
    permanently_stopped = []
    valid_symbols = []
    
    for symbol in symbols:
        # Check permanent blacklist first (highest priority)
        if is_permanently_stopped(symbol):
            permanently_stopped.append(symbol)
            logger.debug(f"⛔ Skipping permanently stopped: {symbol}")
        # Check if symbol ends with -STOPPED or has STOPPED marker
        elif '-STOPPED' in symbol.upper() or symbol.upper().endswith('STOPPED'):
            stopped_symbols.append(symbol)
        else:
            valid_symbols.append(symbol)
    
    if permanently_stopped:
        logger.info(f"⛔ Skipping {len(permanently_stopped)} PERMANENTLY STOPPED symbols")
    
    if stopped_symbols:
        logger.info(f"⏭️ Skipping {len(stopped_symbols)} STOPPED symbols")
        save_to_subscription_file('stopped_companies.json', stopped_symbols)
    
    if not valid_symbols:
        logger.warning("No valid symbols to subscribe after filtering STOPPED")
        return {
            'success': True,
            'count': 0,
            'failed': [],
            'stopped': stopped_symbols + permanently_stopped,
            'permanently_stopped': permanently_stopped,
            'symbols': [],
            'message': 'All symbols are STOPPED'
        }
    
    subscribed_count = 0
    failed_symbols = []
    
    try:
        # Rate limiting: Process in batches of 10
        BATCH_SIZE = 10
        
        for i in range(0, len(valid_symbols), BATCH_SIZE):
            batch = valid_symbols[i:i + BATCH_SIZE]
            logger.info(f"Processing batch {i//BATCH_SIZE + 1}/{(len(valid_symbols) + BATCH_SIZE - 1)//BATCH_SIZE}")
            
            for symbol in batch:
                try:
                    clients[sid]['subscriptions'].add(symbol)
                    
                    if symbol not in symbol_to_clients:
                        symbol_to_clients[symbol] = set()
                    symbol_to_clients[symbol].add(sid)
                    
                    symbol_subscriptions[symbol] += 1
                    active_symbols.add(symbol)
                    subscribed_count += 1
                    
                except Exception as e:
                    logger.error(f"Failed to subscribe to {symbol}: {e}")
                    failed_symbols.append(symbol)
            
            # Small delay between batches to prevent overwhelming the service
            if i + BATCH_SIZE < len(valid_symbols):
                await asyncio.sleep(0.1)
        
        # Batch subscribe to Fyers OR fetch from external server
        if is_after_market or not auth_initialized:
            # After market hours: Fetch from external server (port 6969)
            logger.info(f"📡 After-market mode: Fetching historical data from external server for {len(valid_symbols)} symbols")
            asyncio.create_task(send_batch_external_historical_data(sid, valid_symbols))
        elif auth_initialized:
            # Market open: Use Fyers real-time via thread-safe wrapper
            try:
                loop = asyncio.get_event_loop()

                # fyers_subscribe_safe serialises concurrent calls and deduplicates symbols.
                future = loop.run_in_executor(
                    executor,
                    fyers_subscribe_safe,
                    valid_symbols,
                    "SymbolUpdate"
                )

                # 30 second timeout for Fyers subscription
                await asyncio.wait_for(future, timeout=30.0)
                logger.info(f"✅ Batch subscribed to {len(valid_symbols)} symbols in Fyers")

            except asyncio.TimeoutError:
                logger.error("❌ Fyers subscription timed out after 30s")
            except Exception as e:
                logger.error(f"❌ Error in Fyers batch subscription: {e}")
            
            # Background task for historical data (non-blocking)
            asyncio.create_task(send_batch_historical_data(sid, valid_symbols))
        
        logger.info(f"✅ Successfully subscribed to {subscribed_count}/{len(valid_symbols)} symbols")
        
        # Save successful subscriptions
        successful_symbols = [s for s in valid_symbols if s not in failed_symbols]
        if successful_symbols:
            save_to_subscription_file('subscribed_companies.json', successful_symbols)
        
        # Note: failed_symbols from WebSocket errors are handled in onerror callback
        # Local failures are saved here
        if failed_symbols:
            save_to_subscription_file('failed_subscriptions.json', failed_symbols)

        response_data = {
            'success': True,
            'count': subscribed_count,
            'failed': failed_symbols,
            'stopped': stopped_symbols,
            'symbols': successful_symbols,
            'message': f'Subscribed to {subscribed_count} symbols'
        }

        # Emit confirmation event
        await sio.emit('subscriptionConfirm', response_data, room=sid)

        return response_data
        
    except Exception as e:
        logger.error(f"❌ Critical error in subscribe_companies: {e}")
        return {
            'success': False,
            'error': str(e),
            'count': subscribed_count
        }


# Optimized background historical data sender
async def send_batch_historical_data(sid, symbols):
    """
    Send historical data for symbols in background without blocking main thread.
    Uses Fyers API during market hours.
    """
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
                    # ✅ Ensure every data point's symbol field matches this symbol key
                    for dp in hist_data_list:
                        if isinstance(dp, dict) and dp.get('symbol') != symbol:
                            dp['symbol'] = symbol
                    await sio.emit('historicalData', {
                        'symbol': symbol,
                        'data': hist_data_list
                    }, room=sid)
                
                # Small delay to prevent socket flooding
                await asyncio.sleep(0.05)
                
            except asyncio.TimeoutError:
                logger.warning(f"⏱️ Timeout fetching historical data for {symbol}")
            except Exception as e:
                logger.error(f"Error sending historical data for {symbol}: {e}")
        
        logger.info(f"✅ Completed background historical data send for {len(symbols)} symbols")
        
    except Exception as e:
        logger.error(f"❌ Critical error in send_batch_historical_data: {e}")


# Background sender for after-market hours (fetches from external server port 6969)
async def send_batch_external_historical_data(sid, symbols):
    """
    Send historical data for symbols from external server (port 6969).
    Used after market closes when Fyers WebSocket is not active.
    """
    try:
        logger.info(f"📡 Starting batch external data fetch for {len(symbols)} symbols (after-market mode)")
        success_count = 0
        
        for symbol in symbols:
            try:
                loop = asyncio.get_event_loop()
                
                # Fetch from external server
                external_data = await asyncio.wait_for(
                    loop.run_in_executor(executor, fetch_external_historical_data, symbol, None),
                    timeout=15.0
                )
                
                if external_data and len(external_data) > 0:
                    # Store in memory
                    if symbol not in historical_data:
                        historical_data[symbol] = deque(maxlen=MAX_HISTORY_POINTS)
                    
                    for data_point in external_data:
                        historical_data[symbol].append(data_point)
                    
                    # Build and store OHLC candles
                    ohlc_candles = build_ohlc_from_external_data(symbol, external_data)
                    if symbol not in ohlc_data:
                        ohlc_data[symbol] = deque(maxlen=MAX_HISTORY_POINTS)
                    for candle in ohlc_candles:
                        ohlc_data[symbol].append(candle)
                    
                    # Emit historical data
                    await sio.emit('historicalData', {
                        'symbol': symbol,
                        'data': external_data,
                        'source': 'external_server',
                        'is_after_market': True
                    }, room=sid)
                    
                    # Emit OHLC data
                    if ohlc_candles:
                        await sio.emit('ohlcData', {
                            'symbol': symbol,
                            'data': ohlc_candles,
                            'source': 'external_server'
                        }, room=sid)
                    
                    success_count += 1
                else:
                    logger.warning(f"⚠️ No external data available for {symbol}")
                
                # Small delay between symbols
                await asyncio.sleep(0.1)
                
            except asyncio.TimeoutError:
                logger.warning(f"⏱️ Timeout fetching external data for {symbol}")
            except Exception as e:
                logger.error(f"❌ Error fetching external data for {symbol}: {e}")
        
        logger.info(f"✅ After-market data fetch complete: {success_count}/{len(symbols)} symbols loaded from external server")
        
        # Emit completion notification
        await sio.emit('afterMarketDataLoaded', {
            'success': True,
            'loaded': success_count,
            'total': len(symbols),
            'source': 'external_server'
        }, room=sid)
        
    except Exception as e:
        logger.error(f"❌ Critical error in send_batch_external_historical_data: {e}")


# DEPRECATED but kept for backward compatibility
@sio.event
async def subscribe_multiple(sid, data):
    """
    DEPRECATED: Use subscribe_companies instead.
    Kept for backward compatibility.
    """
    logger.warning(f"Client {sid} using deprecated subscribe_multiple, redirecting to subscribe_companies")
    return await subscribe_companies(sid, data)


# Get active subscriptions endpoint (CRITICAL for state persistence)
@sio.event
def get_active_subscriptions(sid, data):
    """
    Returns list of all currently active symbol subscriptions.
    This is CRITICAL for the frontend to fetch current state on page refresh.
    """
    try:
        active_list = list(active_symbols)
        logger.info(f"📡 Client {sid} requested active subscriptions: {len(active_list)} symbols")
        return {
            'success': True,
            'symbols': active_list,
            'count': len(active_list)
        }
    except Exception as e:
        logger.error(f"Error getting active subscriptions: {e}")
        return {
            'success': False,
            'error': str(e),
            'symbols': [],
            'count': 0
        }


@sio.event
async def unsubscribe(sid, data):
    symbol = data.get('symbol')
    if not symbol:
        return {'success': False, 'error': 'No symbol provided'}

    logger.info(f"Client {sid} unsubscribing from {symbol}")

    if sid in clients:
        clients[sid]['subscriptions'].discard(symbol)

    if symbol in symbol_to_clients:
        symbol_to_clients[symbol].discard(sid)
        symbol_subscriptions[symbol] = max(0, symbol_subscriptions[symbol] - 1)

        if symbol_subscriptions[symbol] == 0:
            logger.info(f"No more clients for {symbol}, but keeping background data collection")

    return {'success': True, 'symbol': symbol}


@sio.event
async def get_trading_status(sid, data):
    start_time, end_time = get_trading_hours()
    return {
        'trading_active': is_trading_hours(),
        'trading_start': start_time.isoformat(),
        'trading_end': end_time.isoformat(),
        'current_time': datetime.datetime.now(INDIA_TZ).isoformat(),
        'is_market_day': datetime.datetime.now(INDIA_TZ).weekday() < 5,
        'active_symbols': list(active_symbols),
        'total_data_points': sum(len(data) for data in historical_data.values()),
        'auth_status': auth_initialized
    }


@sio.event
async def get_historical_data_for_date(sid, data):
    symbol = data.get('symbol')
    date = data.get('date')
    
    if not symbol:
        return {'success': False, 'error': 'No symbol provided'}
    
    if not auth_initialized:
        return {'success': False, 'error': 'Authentication not initialized'}
    
    if not date:
        date = datetime.datetime.now(INDIA_TZ).strftime('%Y-%m-%d')
    
    try:
        loop = asyncio.get_event_loop()
        
        # ✅ Add timeout
        hist_data = await asyncio.wait_for(
            loop.run_in_executor(executor, fetch_historical_intraday_data, symbol, date),
            timeout=15.0
        )
        
        return {
            'success': True,
            'symbol': symbol,
            'date': date,
            'data': hist_data
        }
    except asyncio.TimeoutError:
        logger.error(f"⏱️ Timeout fetching historical data for {symbol} on {date}")
        return {'success': False, 'error': 'Request timeout'}
    except Exception as e:
        logger.error(f"Error fetching historical data for date: {e}")
        return {'success': False, 'error': str(e)}


@sio.event
async def get_daily_data(sid, data):
    symbol = data.get('symbol')
    days = data.get('days', 30)
    
    if not symbol:
        return {'success': False, 'error': 'No symbol provided'}
    
    if not auth_initialized:
        return {'success': False, 'error': 'Authentication not initialized'}
    
    try:
        loop = asyncio.get_event_loop()
        
        # ✅ Add timeout
        daily_data = await asyncio.wait_for(
            loop.run_in_executor(executor, fetch_daily_historical_data, symbol, days),
            timeout=10.0
        )
        
        if daily_data:
            formatted_data = []
            for candle in daily_data:
                timestamp, open_price, high_price, low_price, close_price, volume = candle
                formatted_data.append({
                    'timestamp': timestamp,
                    'open': open_price,
                    'high': high_price,
                    'low': low_price,
                    'close': close_price,
                    'volume': volume
                })
            
            return {
                'success': True,
                'symbol': symbol,
                'days': days,
                'data': formatted_data
            }
        else:
            return {'success': False, 'error': 'No data available'}
    except asyncio.TimeoutError:
        logger.error(f"⏱️ Timeout fetching daily data for {symbol}")
        return {'success': False, 'error': 'Request timeout'}
    except Exception as e:
        logger.error(f"Error fetching daily data: {e}")
        return {'success': False, 'error': str(e)}


@sio.event
async def get_after_market_data(sid, data):
    """
    Fetch historical data from external server (port 6969) after market closes.
    This endpoint is specifically for viewing full day's data when market is closed.
    Works even without Fyers authentication.
    """
    symbol = data.get('symbol')
    date = data.get('date')  # Optional: defaults to today
    
    if not symbol:
        return {'success': False, 'error': 'No symbol provided'}
    
    try:
        loop = asyncio.get_event_loop()
        
        # Fetch from external server (doesn't need Fyers auth)
        external_data = await asyncio.wait_for(
            loop.run_in_executor(executor, fetch_external_historical_data, symbol, date),
            timeout=30.0
        )
        
        if external_data and len(external_data) > 0:
            # Build OHLC candles from tick data
            ohlc_candles = build_ohlc_from_external_data(symbol, external_data)
            
            # Store in memory for client use
            if symbol not in historical_data:
                historical_data[symbol] = deque(maxlen=MAX_HISTORY_POINTS)
            
            for point in external_data:
                historical_data[symbol].append(point)
            
            if symbol not in ohlc_data:
                ohlc_data[symbol] = deque(maxlen=MAX_HISTORY_POINTS)
            
            for candle in ohlc_candles:
                ohlc_data[symbol].append(candle)
            
            active_symbols.add(symbol)
            
            logger.info(f"✅ After-market data loaded for {symbol}: {len(external_data)} ticks, {len(ohlc_candles)} candles")
            
            return {
                'success': True,
                'symbol': symbol,
                'source': 'external_server',
                'is_after_market': True,
                'tick_count': len(external_data),
                'candle_count': len(ohlc_candles),
                'data': external_data,
                'ohlc': ohlc_candles
            }
        else:
            return {
                'success': False,
                'error': f'No after-market data available for {symbol}',
                'source': 'external_server'
            }
            
    except asyncio.TimeoutError:
        logger.error(f"⏱️ Timeout fetching after-market data for {symbol}")
        return {'success': False, 'error': 'Request timeout'}
    except Exception as e:
        logger.error(f"❌ Error fetching after-market data for {symbol}: {e}")
        return {'success': False, 'error': str(e)}


@sio.event
async def get_market_data_smart(sid, data):
    """
    Smart endpoint that automatically fetches from the right source:
    - During market hours: Uses Fyers WebSocket (real-time)
    - After market closes: Fetches from external server (port 6969)
    - Before market opens: Fetches previous day's data from external server
    """
    symbol = data.get('symbol')
    date = data.get('date')  # Optional
    
    if not symbol:
        return {'success': False, 'error': 'No symbol provided'}
    
    is_market_open = is_trading_hours()
    is_after_market = is_after_market_hours()
    
    logger.info(f"📊 Smart fetch for {symbol} - Market open: {is_market_open}, After market: {is_after_market}")
    
    # If market is open and we have Fyers auth, use real-time data
    if is_market_open and auth_initialized:
        # Return cached data if available
        if symbol in historical_data and len(historical_data[symbol]) > 0:
            return {
                'success': True,
                'symbol': symbol,
                'source': 'fyers_realtime',
                'is_live': True,
                'data': list(historical_data[symbol]),
                'ohlc': list(ohlc_data.get(symbol, []))
            }
        else:
            return {
                'success': True,
                'symbol': symbol,
                'source': 'fyers_realtime',
                'is_live': True,
                'data': [],
                'message': 'Subscribe to symbol to receive live data'
            }
    
    # Market closed or no auth - fetch from external server
    try:
        loop = asyncio.get_event_loop()
        
        # Use today's date if not specified and it's after market
        if not date and is_after_market:
            date = datetime.datetime.now(INDIA_TZ).strftime('%Y-%m-%d')
        
        external_data = await asyncio.wait_for(
            loop.run_in_executor(executor, fetch_external_historical_data, symbol, date),
            timeout=30.0
        )
        
        if external_data and len(external_data) > 0:
            ohlc_candles = build_ohlc_from_external_data(symbol, external_data)
            
            return {
                'success': True,
                'symbol': symbol,
                'source': 'external_server',
                'is_live': False,
                'is_after_market': is_after_market,
                'tick_count': len(external_data),
                'candle_count': len(ohlc_candles),
                'data': external_data,
                'ohlc': ohlc_candles
            }
        else:
            return {
                'success': False,
                'error': f'No data available for {symbol}',
                'source': 'external_server'
            }
            
    except asyncio.TimeoutError:
        logger.error(f"⏱️ Timeout in smart fetch for {symbol}")
        return {'success': False, 'error': 'Request timeout'}
    except Exception as e:
        logger.error(f"❌ Error in smart fetch for {symbol}: {e}")
        return {'success': False, 'error': str(e)}


# ============ Data Storage and Processing ============
def store_historical_data(symbol, data_point):
    """Store data for ALL active symbols"""
    if symbol not in historical_data:
        historical_data[symbol] = deque(maxlen=MAX_HISTORY_POINTS)

    if 'timestamp' not in data_point:
        data_point['timestamp'] = int(time.time())

    historical_data[symbol].append(data_point)
    update_ohlc_data(symbol, data_point)

    if symbol not in chart_updates:
        chart_updates[symbol] = deque(maxlen=MAX_CHART_UPDATES)

    chart_update = {
        'symbol': symbol,
        'price': data_point['ltp'],
        'timestamp': data_point['timestamp'],
        'volume': data_point.get('volume', 0),
        'change': data_point.get('change', 0),
        'changePercent': data_point.get('changePercent', 0)
    }
    chart_updates[symbol].append(chart_update)


def update_ohlc_data(symbol, data_point):
    if symbol not in ohlc_data:
        ohlc_data[symbol] = deque(maxlen=MAX_HISTORY_POINTS)

    timestamp = data_point['timestamp']
    price = data_point['ltp']

    minute_timestamp = (timestamp // 60) * 60
    current_cumulative_volume = data_point.get('volume', 0)

    if not ohlc_data[symbol] or ohlc_data[symbol][-1]['timestamp'] < minute_timestamp:
        # New candle for new minute
        # Store the cumulative volume at the START of this candle
        ohlc_data[symbol].append({
            'timestamp': minute_timestamp,
            'open': price,
            'high': price,
            'low': price,
            'close': price,
            'volume': 0,  # Will be calculated as delta when candle closes
            '_start_cumulative_vol': current_cumulative_volume  # Track starting volume for delta calculation
        })
    else:
        current_candle = ohlc_data[symbol][-1]
        current_candle['high'] = max(current_candle['high'], price)
        current_candle['low'] = min(current_candle['low'], price)
        current_candle['close'] = price
        # ✅ FIX: Calculate delta volume (current cumulative - starting cumulative for this candle)
        start_vol = current_candle.get('_start_cumulative_vol', None)
        if start_vol is None:
            # History candle (loaded from Fyers API, no _start_cumulative_vol set).
            # Initialize it so the existing per-minute volume is preserved and
            # subsequent ticks accumulate correctly on top of it.
            # Formula: start_vol = current_cumulative - existing_volume
            # → delta for this tick = current_cumulative - start_vol = existing_volume ✓
            existing_volume = current_candle.get('volume', 0) or 0
            start_vol = max(0, current_cumulative_volume - existing_volume)
            current_candle['_start_cumulative_vol'] = start_vol
        if current_cumulative_volume >= start_vol:
            current_candle['volume'] = current_cumulative_volume - start_vol
        else:
            # Reset happened (new day), use current as-is
            current_candle['volume'] = current_cumulative_volume


def calculate_indicators_optimized(symbol, init=False):
    if symbol not in ohlc_data or len(ohlc_data[symbol]) < 20:
        return {}

    latest_close = ohlc_data[symbol][-1]['close']

    if symbol not in cached_indicators or init:
        closes = np.array([candle['close'] for candle in ohlc_data[symbol]])

        sma_20 = np.mean(closes[-20:]) if len(closes) >= 20 else latest_close

        if len(closes) >= 9:
            ema_9 = closes[0]
            alpha = 2 / (9 + 1)
            for price in closes[1:]:
                ema_9 = alpha * price + (1 - alpha) * ema_9
        else:
            ema_9 = latest_close

        if len(closes) >= 15:
            changes = np.diff(closes)
            gains = np.where(changes > 0, changes, 0)
            losses = np.where(changes < 0, -changes, 0)

            avg_gain = np.mean(gains[-14:])
            avg_loss = np.mean(losses[-14:])

            if avg_loss == 0:
                rsi = 100
            else:
                rs = avg_gain / avg_loss
                rsi = 100 - (100 / (1 + rs))
        else:
            rsi = 50

        cached_indicators[symbol] = {
            'sma_20': float(sma_20),
            'ema_9': float(ema_9),
            'rsi_14': float(rsi),
            'avg_gain': avg_gain if len(closes) >= 15 else 0,
            'avg_loss': avg_loss if len(closes) >= 15 else 0,
            'prev_close': latest_close
        }
    else:
        cache = cached_indicators[symbol]
        prev_close = cache['prev_close']

        if len(ohlc_data[symbol]) >= 20:
            old_sma = cache['sma_20']
            cache['sma_20'] = old_sma + (latest_close - old_sma) / 20

        alpha = 2 / (9 + 1)
        cache['ema_9'] = alpha * latest_close + (1 - alpha) * cache['ema_9']

        change = latest_close - prev_close
        gain = max(0, change)
        loss = max(0, -change)

        cache['avg_gain'] = (cache['avg_gain'] * 13 + gain) / 14
        cache['avg_loss'] = (cache['avg_loss'] * 13 + loss) / 14

        if cache['avg_loss'] == 0:
            cache['rsi_14'] = 100
        else:
            rs = cache['avg_gain'] / cache['avg_loss']
            cache['rsi_14'] = 100 - (100 / (1 + rs))

        cache['prev_close'] = latest_close

    return {
        'sma_20': cached_indicators[symbol]['sma_20'],
        'ema_9': cached_indicators[symbol]['ema_9'],
        'rsi_14': cached_indicators[symbol]['rsi_14']
    }


# ============ Background Tasks ============
async def emit_real_time_data():
    """Enhanced to emit data for all symbols and manage background collection"""
    global running
    while running:
        try:
            current_time = time.time()

            cleanup_old_data()

            for symbol in list(pending_data.keys()):
                if symbol in pending_data:
                    data = pending_data[symbol].copy()

                    # ✅ STRICT SYMBOL CONSISTENCY: Ensure the data's symbol field
                    # always matches the loop key. Prevents cross-symbol data leakage
                    # if pending_data ever gets an inconsistent state.
                    if data.get('symbol') != symbol:
                        logger.warning(f"Symbol mismatch corrected: data.symbol={data.get('symbol')} != key={symbol}")
                        data['symbol'] = symbol

                    if symbol in symbol_to_clients and symbol_to_clients[symbol]:
                        if current_time - last_emit_time[symbol] >= REAL_TIME_INTERVAL:
                            for sid in list(symbol_to_clients[symbol]):
                                try:
                                    await sio.emit('marketDataUpdate', data, room=sid)

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
                                    logger.error(f"Error sending data to client {sid}: {e}")

                            last_emit_time[symbol] = current_time

                    store_historical_data(symbol, data)

            await asyncio.sleep(CHART_UPDATE_INTERVAL)

        except Exception as e:
            logger.error(f"Error in real-time emission: {e}")
            await asyncio.sleep(0.1)


def onmessage(message):
    """Handle WebSocket messages from Fyers"""
    if not isinstance(message, dict) or 'symbol' not in message:
        return

    symbol = message['symbol']
    if not symbol or not isinstance(symbol, str):
        return

    if message.get('type') == 'sub':
        logger.info(f"Subscription confirmation: {symbol}")
        return

    active_symbols.add(symbol)

    simplified_data = {
        'symbol': symbol,
        'ltp': message.get('ltp'),
        'change': message.get('ch'),
        'changePercent': message.get('chp'),
        'volume': message.get('vol_traded_today'),
        'open': message.get('open_price'),
        'high': message.get('high_price'),
        'low': message.get('low_price'),
        'close': message.get('prev_close_price'),
        'bid': message.get('bid_price'),
        'ask': message.get('ask_price'),
        'timestamp': message.get('last_traded_time') or int(time.time())
    }

    indicators = calculate_indicators_optimized(symbol)
    if indicators:
        simplified_data.update(indicators)

    pending_data[symbol] = simplified_data


def onerror(error):
    logger.error(f"Error: {error}")
    
    # Extract and save failed/invalid symbols from Fyers error
    try:
        error_data = error if isinstance(error, dict) else {}
        if isinstance(error, str):
            # Try to parse if it's a string representation of dict
            import ast
            try:
                error_data = ast.literal_eval(error)
            except:
                pass
        
        invalid_symbols = error_data.get('invalid_symbols', [])
        if invalid_symbols:
            # Check for daily reset before saving
            check_and_reset_subscription_files()
            
            # Save to failed_subscriptions.json using helper
            save_to_subscription_file('failed_subscriptions.json', invalid_symbols)
            
            # Also add to permanent blacklist so they won't be tried again
            add_to_permanent_blacklist(invalid_symbols)
            
            logger.info(f"💾 Saved {len(invalid_symbols)} invalid symbols: {invalid_symbols}")
    except Exception as e:
        logger.error(f"Error saving failed subscriptions: {e}")
    
    if main_loop and main_loop.is_running():
        asyncio.run_coroutine_threadsafe(sio.emit('error', {'message': str(error)}), main_loop)


def onclose(message):
    logger.info(f"Connection closed: {message}")
    if main_loop and main_loop.is_running():
        asyncio.run_coroutine_threadsafe(sio.emit('fyersDisconnected', {'message': str(message)}), main_loop)

    # Clear subscribed-symbol tracking so onopen() will re-subscribe everything.
    # This is necessary because the Fyers WebSocket loses all subscriptions on disconnect.
    global _fyers_subscribed_symbols
    with _fyers_subscribe_lock:
        _fyers_subscribed_symbols.clear()
    logger.info("[onclose] Cleared _fyers_subscribed_symbols — will re-subscribe on reconnect")


def onopen():
    logger.info("Fyers WebSocket connected")
    if main_loop and main_loop.is_running():
        asyncio.run_coroutine_threadsafe(sio.emit('fyersConnected', {'status': 'connected'}), main_loop)

    symbols_to_subscribe = list(active_symbols) if active_symbols else []
    if symbols_to_subscribe:
        # fyers_subscribe_safe holds the lock and skips already-subscribed symbols.
        # _fyers_subscribed_symbols was cleared in onclose(), so on reconnect ALL
        # active symbols will be re-submitted exactly once.
        fyers_subscribe_safe(symbols_to_subscribe, "SymbolUpdate")
        logger.info(f"[onopen] Subscribed to {len(symbols_to_subscribe)} symbols for background collection")


async def heartbeat_task():
    global running
    while running:
        try:
            await sio.emit('heartbeat', {
                'timestamp': int(time.time()),
                'trading_active': is_trading_hours(),
                'after_market': is_after_market_hours(),
                'server_time': datetime.datetime.now(INDIA_TZ).isoformat(),
                'active_symbols': list(active_symbols),
                'total_cached_points': sum(len(data) for data in historical_data.values()),
                'background_collection': True,
                'auth_status': auth_initialized,
                'external_server': EXTERNAL_DATA_SERVER,
                'data_source': 'fyers_realtime' if is_trading_hours() and auth_initialized else 'external_server'
            })
            await asyncio.sleep(10)
        except Exception as e:
            logger.error(f"Error in heartbeat: {e}")


# ============ Main Application ============
async def startup_tasks():
    """Run all startup tasks"""
    global fyers, main_loop
    main_loop = asyncio.get_running_loop()
    
    # Create data directory
    os.makedirs('data', exist_ok=True)
    
    # Load permanent blacklist (symbols that should never be subscribed)
    load_permanent_blacklist()
    
    # Check for daily reset of subscription files
    check_and_reset_subscription_files()
    
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
    asyncio.create_task(auth_watcher())
    asyncio.create_task(heartbeat_task())
    asyncio.create_task(emit_real_time_data())
    
    logger.info("✅ All background tasks started")


async def main():
    """Main entry point"""
    global running
    
    try:
        # Start background tasks
        await startup_tasks()
        
        # Configure and run Uvicorn
        config = uvicorn.Config(
            app=app,
            host='0.0.0.0',
            port=int(os.getenv('PORT', '5001')),
            log_level='info',
            loop='asyncio',
            ws='websockets',
            timeout_keep_alive=75,  # ✅ Increased keep-alive
            limit_concurrency=100,  # ✅ Limit concurrent connections
        )
        server = uvicorn.Server(config)
        
        logger.info(f"✅ Starting Socket.IO server with AsyncIO + Uvicorn on port {int(os.getenv('PORT', '5001'))}...")
        logger.info("🔑 Using auto authentication with JWT token handling")
        logger.info("📊 Features: Background collection, 24h retention, optimized indicators")
        logger.info("⚡ Enhanced: Timeout protection, rate limiting, batch operations")
        logger.info(f"📡 After-market mode: External server at {EXTERNAL_DATA_SERVER}")
        logger.info(f"🕐 Current market status: {'OPEN' if is_trading_hours() else ('AFTER-MARKET' if is_after_market_hours() else 'CLOSED')}")
        
        await server.serve()
        
    except Exception as e:
        logger.error(f"Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        running = False
        executor.shutdown(wait=True)  # ✅ Clean shutdown


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("Shutting down server...")
        running = False
