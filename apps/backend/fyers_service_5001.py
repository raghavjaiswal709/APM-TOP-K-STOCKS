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
from collections import deque, defaultdict
from fyers_apiv3 import fyersModel
from fyers_apiv3.FyersWebsocket import data_ws

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger("FyersServer")

sio = socketio.Server(cors_allowed_origins='*', async_mode='eventlet')
app = socketio.WSGIApp(sio)

client_id = "VEACWVGEUC-100"
secret_key = "2O7GBQ7A7H"
redirect_uri = "https://raghavjaiswal709.github.io/DAKSphere_redirect_PROD/"
response_type = "code"
grant_type = "authorization_code"

clients = {}
symbol_to_clients = {}
running = True
auth_initialized = False

# ============ ENHANCED: Multi-symbol persistent data storage ============
historical_data = {}           # All historical data for all symbols
ohlc_data = {}                # All OHLC data for all symbols
chart_updates = {}            # Real-time updates for all symbols
active_symbols = set()        # All symbols currently being tracked
symbol_subscriptions = defaultdict(int)  # Count of clients per symbol

MAX_HISTORY_POINTS = 50000    # Increased from 10000 for longer retention
MAX_CHART_UPDATES = 5000      # Keep more chart updates
DATA_RETENTION_HOURS = 24     # Keep data for 24 hours

INDIA_TZ = pytz.timezone('Asia/Kolkata')

fyers = None
fyers_client = None

# ============ ENHANCED: Real-time Configuration ============
REAL_TIME_INTERVAL = 0.2
CHART_UPDATE_INTERVAL = 0.1
last_emit_time = defaultdict(float)
pending_data = {}

# ============ ENHANCED: Persistent data management ============
cached_indicators = {}
data_cleanup_interval = 3600  # Cleanup every hour
last_cleanup_time = time.time()


def extract_jwt_token(full_token):
    """Extract JWT token from full token string."""
    if ':' in full_token:
        return full_token.split(':', 1)[1]
    else:
        return full_token


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
                log_path=None
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
                                if active_symbols and hasattr(fyers, 'subscribe'):
                                    symbols_list = list(active_symbols)
                                    fyers.subscribe(symbols=symbols_list, data_type="SymbolUpdate")
                                    logger.info(f"✅ Resubscribed to {len(symbols_list)} symbols")
                            except Exception as e:
                                logger.error(f"❌ WebSocket start error: {e}")
                    last_modified = current_modified
            time.sleep(5)
        except Exception as e:
            logger.error(f"❌ Auth watcher error: {e}")
            time.sleep(10)


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
            # Keep only recent data
            recent_data = deque(maxlen=MAX_HISTORY_POINTS)
            for point in historical_data[symbol]:
                if point['timestamp'] > cutoff_time:
                    recent_data.append(point)

            if len(recent_data) > 0:
                historical_data[symbol] = recent_data
            else:
                # Remove completely old symbols that have no subscribers
                if symbol_subscriptions[symbol] == 0:
                    del historical_data[symbol]
                    cleaned_symbols.append(symbol)

        if symbol in ohlc_data:
            # Keep only recent OHLC data
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
            # Keep only recent chart updates
            recent_updates = deque(maxlen=MAX_CHART_UPDATES)
            for update in chart_updates[symbol]:
                if update['timestamp'] > cutoff_time:
                    recent_updates.append(update)

            if len(recent_updates) > 0:
                chart_updates[symbol] = recent_updates
            elif symbol_subscriptions[symbol] == 0:
                if symbol in chart_updates:
                    del chart_updates[symbol]

    # Clean up cached indicators for removed symbols
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


@sio.event
def connect(sid, environ):
    logger.info(f"Client connected: {sid}")
    clients[sid] = {'subscriptions': set(), 'last_ping': time.time()}
    
    # Send auth status to new client
    sio.emit('authStatus', {
        'authenticated': auth_initialized,
        'timestamp': int(time.time())
    }, room=sid)


@sio.event
def disconnect(sid):
    logger.info(f"Client disconnected: {sid}")
    if sid in clients:
        # Decrease subscription count for each symbol
        for symbol in clients[sid]['subscriptions']:
            if symbol in symbol_to_clients:
                symbol_to_clients[symbol].discard(sid)
            symbol_subscriptions[symbol] = max(0, symbol_subscriptions[symbol] - 1)

            # If no more clients, but keep collecting data in background for a while
            if symbol_subscriptions[symbol] == 0:
                logger.info(f"No more active clients for {symbol}, but keeping background collection")

        del clients[sid]


def fetch_historical_intraday_data(symbol, date=None):
    """Enhanced to always fetch and store data regardless of current subscriptions"""
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

                # ============ ENHANCED: Always store regardless of active subscriptions ============
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
                # Mark symbol as active for background collection
                active_symbols.add(symbol)

            return result
        else:
            logger.error(f"Failed to fetch historical data: {response}")

        return []

    except Exception as e:
        logger.error(f"Error fetching historical data: {e}")
        import traceback
        traceback.print_exc()
        return []


def fetch_daily_historical_data(symbol, days=30):
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
def subscribe(sid, data):
    symbol = data.get('symbol')
    if not symbol:
        return {'success': False, 'error': 'No symbol provided'}
    
    if not auth_initialized:
        return {'success': False, 'error': 'Authentication not initialized'}

    logger.info(f"Client {sid} subscribing to {symbol}")

    clients[sid]['subscriptions'].add(symbol)
    if symbol not in symbol_to_clients:
        symbol_to_clients[symbol] = set()
    symbol_to_clients[symbol].add(sid)

    # Increase subscription count
    symbol_subscriptions[symbol] += 1
    active_symbols.add(symbol)

    # ============ ENHANCED: Check if we already have cached data ============
    if symbol not in historical_data or not historical_data[symbol]:
        logger.info(f"Fetching fresh historical data for {symbol}")
        hist_data = fetch_historical_intraday_data(symbol)

        if symbol not in historical_data:
            historical_data[symbol] = deque(maxlen=MAX_HISTORY_POINTS)

        for data_point in hist_data:
            historical_data[symbol].append(data_point)
    else:
        logger.info(f"Using cached historical data for {symbol} ({len(historical_data[symbol])} points)")

    # Subscribe to real-time updates if not already subscribed
    if fyers and hasattr(fyers, 'subscribe') and callable(fyers.subscribe):
        logger.info(f"Subscribing to real-time updates for: {symbol}")
        try:
            fyers.subscribe(symbols=[symbol], data_type="SymbolUpdate")
        except Exception as e:
            logger.error(f"Error subscribing to {symbol}: {e}")

    # Send all available data to client
    if symbol in historical_data and historical_data[symbol]:
        logger.info(f"Sending {len(historical_data[symbol])} historical data points for {symbol}")
        hist_data_list = list(historical_data[symbol])
        sio.emit('historicalData', {
            'symbol': symbol,
            'data': hist_data_list
        }, room=sid)

    if symbol in ohlc_data and ohlc_data[symbol]:
        logger.info(f"Sending {len(ohlc_data[symbol])} OHLC data points for {symbol}")
        sio.emit('ohlcData', {
            'symbol': symbol,
            'data': list(ohlc_data[symbol])
        }, room=sid)

    # Send cached chart updates if available
    if symbol in chart_updates and chart_updates[symbol]:
        logger.info(f"Sending {len(chart_updates[symbol])} cached chart updates for {symbol}")
        sio.emit('chartUpdatesHistory', {
            'symbol': symbol,
            'data': list(chart_updates[symbol])
        }, room=sid)

    return {'success': True, 'symbol': symbol, 'cached_points': len(historical_data.get(symbol, []))}


@sio.event
def unsubscribe(sid, data):
    symbol = data.get('symbol')
    if not symbol:
        return {'success': False, 'error': 'No symbol provided'}

    logger.info(f"Client {sid} unsubscribing from {symbol}")

    if sid in clients:
        clients[sid]['subscriptions'].discard(symbol)

    if symbol in symbol_to_clients:
        symbol_to_clients[symbol].discard(sid)

        # Decrease subscription count but don't unsubscribe from Fyers immediately
        symbol_subscriptions[symbol] = max(0, symbol_subscriptions[symbol] - 1)

        # Keep collecting data for a while even if no active clients
        if symbol_subscriptions[symbol] == 0:
            logger.info(f"No more clients for {symbol}, but keeping background data collection")
            # Note: We intentionally don't unsubscribe from Fyers to keep background collection

    return {'success': True, 'symbol': symbol}


@sio.event
def get_trading_status(sid, data):
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
def get_historical_data_for_date(sid, data):
    symbol = data.get('symbol')
    date = data.get('date')
    
    if not symbol:
        return {'success': False, 'error': 'No symbol provided'}
    
    if not auth_initialized:
        return {'success': False, 'error': 'Authentication not initialized'}
    
    if not date:
        date = datetime.datetime.now(INDIA_TZ).strftime('%Y-%m-%d')
    
    try:
        hist_data = fetch_historical_intraday_data(symbol, date)
        
        return {
            'success': True,
            'symbol': symbol,
            'date': date,
            'data': hist_data
        }
    except Exception as e:
        logger.error(f"Error fetching historical data for date: {e}")
        return {'success': False, 'error': str(e)}


@sio.event
def get_daily_data(sid, data):
    symbol = data.get('symbol')
    days = data.get('days', 30)
    
    if not symbol:
        return {'success': False, 'error': 'No symbol provided'}
    
    if not auth_initialized:
        return {'success': False, 'error': 'Authentication not initialized'}
    
    try:
        daily_data = fetch_daily_historical_data(symbol, days)
        
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
    except Exception as e:
        logger.error(f"Error fetching daily data: {e}")
        return {'success': False, 'error': str(e)}


def store_historical_data(symbol, data_point):
    """Enhanced to store data for ALL active symbols"""
    if symbol not in historical_data:
        historical_data[symbol] = deque(maxlen=MAX_HISTORY_POINTS)

    if 'timestamp' not in data_point:
        data_point['timestamp'] = int(time.time())

    historical_data[symbol].append(data_point)
    update_ohlc_data(symbol, data_point)

    # Also store in chart updates for smooth transitions
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

    if not ohlc_data[symbol] or ohlc_data[symbol][-1]['timestamp'] < minute_timestamp:
        ohlc_data[symbol].append({
            'timestamp': minute_timestamp,
            'open': price,
            'high': price,
            'low': price,
            'close': price,
            'volume': data_point.get('volume', 0)
        })
    else:
        current_candle = ohlc_data[symbol][-1]
        current_candle['high'] = max(current_candle['high'], price)
        current_candle['low'] = min(current_candle['low'], price)
        current_candle['close'] = price
        current_candle['volume'] = data_point.get('volume', current_candle['volume'])


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


# ============ ENHANCED: Background data collection for all symbols ============
def emit_real_time_data():
    """Enhanced to emit data for all symbols and manage background collection"""
    global running
    while running:
        try:
            current_time = time.time()

            # Cleanup old data periodically
            cleanup_old_data()

            # Emit data for all symbols that have pending updates
            for symbol in list(pending_data.keys()):
                # Always store data regardless of active clients
                if symbol in pending_data:
                    data = pending_data[symbol].copy()

                    # Emit to subscribed clients if any
                    if symbol in symbol_to_clients and symbol_to_clients[symbol]:
                        if current_time - last_emit_time[symbol] >= REAL_TIME_INTERVAL:
                            for sid in list(symbol_to_clients[symbol]):
                                try:
                                    sio.emit('marketDataUpdate', data, room=sid)

                                    # Send chart-specific update
                                    chart_update = {
                                        'symbol': symbol,
                                        'price': data['ltp'],
                                        'timestamp': data['timestamp'],
                                        'volume': data.get('volume', 0),
                                        'change': data.get('change', 0),
                                        'changePercent': data.get('changePercent', 0)
                                    }
                                    sio.emit('chartUpdate', chart_update, room=sid)

                                except Exception as e:
                                    logger.error(f"Error sending data to client {sid}: {e}")

                            last_emit_time[symbol] = current_time

                    # Always store data even if no active clients (background collection)
                    store_historical_data(symbol, data)

            eventlet.sleep(CHART_UPDATE_INTERVAL)

        except Exception as e:
            logger.error(f"Error in real-time emission: {e}")
            eventlet.sleep(0.1)


def onmessage(message):
    """Enhanced to handle ALL symbols, not just subscribed ones"""
    if not isinstance(message, dict) or 'symbol' not in message:
        return

    symbol = message['symbol']

    if message.get('type') == 'sub':
        logger.info(f"Subscription confirmation: {symbol}")
        return

    # Always add symbol to active symbols when we receive data
    active_symbols.add(symbol)

    # Create optimized data structure
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

    # Calculate indicators with caching
    indicators = calculate_indicators_optimized(symbol)
    if indicators:
        simplified_data.update(indicators)

    # Store for ALL symbols (background + active)
    pending_data[symbol] = simplified_data

    eventlet.sleep(0)


def onerror(error):
    logger.error(f"Error: {error}")
    sio.emit('error', {'message': str(error)})


def onclose(message):
    logger.info(f"Connection closed: {message}")
    sio.emit('fyersDisconnected', {'message': str(message)})


def onopen():
    logger.info("Fyers WebSocket connected")
    sio.emit('fyersConnected', {'status': 'connected'})

    # Subscribe to all active symbols (including background ones)
    symbols_to_subscribe = list(active_symbols) if active_symbols else []
    if symbols_to_subscribe and fyers and hasattr(fyers, 'subscribe'):
        try:
            fyers.subscribe(symbols=symbols_to_subscribe, data_type="SymbolUpdate")
            logger.info(f"Subscribed to {len(symbols_to_subscribe)} symbols for background collection")
        except Exception as e:
            logger.error(f"Error subscribing to symbols: {e}")


def heartbeat_task():
    global running
    while running:
        try:
            sio.emit('heartbeat', {
                'timestamp': int(time.time()),
                'trading_active': is_trading_hours(),
                'server_time': datetime.datetime.now(INDIA_TZ).isoformat(),
                'active_symbols': list(active_symbols),
                'total_cached_points': sum(len(data) for data in historical_data.values()),
                'background_collection': True,
                'auth_status': auth_initialized
            })
            eventlet.sleep(10)
        except Exception as e:
            logger.error(f"Error in heartbeat: {e}")


def main_process():
    global fyers, fyers_client, running

    try:
        # Create data directory
        os.makedirs('data', exist_ok=True)
        
        # Try initial authentication
        if initialize_fyers():
            logger.info("✅ Initial authentication successful")
            
            if fyers:
                ws_thread = threading.Thread(target=lambda: fyers.connect(), daemon=True)
                ws_thread.start()
                logger.info("✅ WebSocket connection started")
        else:
            logger.info("⚠️ Initial authentication failed, will retry when auth file updates")
        
        # Start auth watcher
        auth_thread = threading.Thread(target=auth_watcher, daemon=True)
        auth_thread.start()

        # Start heartbeat
        heartbeat_thread = threading.Thread(target=heartbeat_task, daemon=True)
        heartbeat_thread.start()

        # Start real-time data emission
        emission_thread = threading.Thread(target=emit_real_time_data, daemon=True)
        emission_thread.start()

        logger.info("✅ Starting enhanced Socket.IO server with persistent multi-symbol data on port 5001...")
        logger.info("🔑 Using auto authentication with JWT token handling")
        logger.info("📊 Features: Background collection, 24h retention, optimized indicators")
        eventlet.wsgi.server(eventlet.listen(('0.0.0.0', 5001)), app)

    except Exception as e:
        logger.error(f"Error: {e}")
        import traceback
        traceback.print_exc()


def main():
    global running

    try:
        eventlet.spawn(main_process)

        while running:
            eventlet.sleep(0.1)
    except KeyboardInterrupt:
        logger.info("Shutting down enhanced server...")
        running = False


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        logger.info("Shutting down enhanced server...")
        running = False
