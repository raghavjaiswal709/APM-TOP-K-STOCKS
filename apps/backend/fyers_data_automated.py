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
    logger=True,
    engineio_logger=True
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

def fetch_historical_intraday_data(symbol, date=None):
    """Fetch historical intraday data for a symbol."""
    if not date:
        date = datetime.datetime.now(INDIA_TZ).strftime('%Y-%m-%d')
    
    try:
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
        
        if fyers_client:
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
                
                # Calculate change and change percent
                if result:
                    prev_close = result[0]['open']
                    for point in result:
                        point['change'] = point['ltp'] - prev_close
                        point['changePercent'] = (point['change'] / prev_close) * 100 if prev_close else 0
                
                return result
            else:
                logger.error(f"❌ Failed to fetch historical data for {symbol}: {response}")
        
        return []
        
    except Exception as e:
        logger.error(f"❌ Error fetching historical data for {symbol}: {e}")
        return []

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
        'fyers_status': 'connected' if fyers else 'disconnected'
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
    """Handle subscription requests from clients on port 5001."""
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
    
    # Fetch and send historical data
    if symbol not in historical_data_5001 or not historical_data_5001[symbol]:
        logger.info(f"[5001] Fetching historical data for {symbol}")
        hist_data = fetch_historical_intraday_data(symbol)
        
        if symbol not in historical_data_5001:
            historical_data_5001[symbol] = deque(maxlen=MAX_HISTORY_POINTS)
        
        for data_point in hist_data:
            historical_data_5001[symbol].append(data_point)
    
    # Send historical data
    if symbol in historical_data_5001 and historical_data_5001[symbol]:
        hist_data_list = list(historical_data_5001[symbol])
        sio_5001.emit('historicalData', {
            'symbol': symbol,
            'data': hist_data_list
        }, room=sid)
    
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
        'is_market_day': datetime.datetime.now(INDIA_TZ).weekday() < 5
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
        }
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
    """Subscribe to selected companies on port 5010."""
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
        
        # Send historical data for each symbol
        for symbol in requested_symbols:
            # Send any existing historical data
            if symbol in historical_data_5010 and historical_data_5010[symbol]:
                sio_5010.emit('historicalData', {
                    'symbol': symbol,
                    'data': list(historical_data_5010[symbol])
                }, room=sid)
            else:
                # Fetch historical data on demand
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
        
        # Send subscription confirmation
        sio_5010.emit('subscriptionConfirm', {
            'success': True,
            'symbols': requested_symbols,
            'count': len(requested_symbols)
        }, room=sid)
        
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
            'connected_clients': len(clients_5010)
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

# ============= AUTHENTICATION HANDLER =============
def initialize_fyers_from_auth_file():
    """Initialize Fyers client from auth file - NO WAITING"""
    global fyers, fyers_client, access_token
    
    auth_file_path = os.path.join('data', 'fyers_data_auth.json')
    
    try:
        if os.path.exists(auth_file_path):
            with open(auth_file_path, 'r') as f:
                auth_data = json.load(f)
                
            access_token = auth_data.get('access_token')
            if access_token:
                logger.info("✅ Found existing authentication data")
                
                # Extract token
                token_only = access_token.replace(f"{client_id}:", "") if access_token.startswith(client_id) else access_token
                
                # Initialize Fyers client
                fyers_client = fyersModel.FyersModel(
                    client_id=client_id,
                    token=token_only,
                    log_path=""
                )
                
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
                
                logger.info("✅ Fyers client and WebSocket initialized from existing auth")
                return True
            else:
                logger.warning("⚠️ No access token in auth file")
        else:
            logger.info("ℹ️ No auth file found - will wait for UI authentication")
            
    except Exception as e:
        logger.error(f"❌ Error loading auth data: {e}")
    
    return False

# ============= HEARTBEAT AND MONITORING =============
def heartbeat_task():
    """Send periodic heartbeat to clients on both ports."""
    global running
    while running:
        try:
            heartbeat_data = {
                'timestamp': int(time.time()),
                'trading_active': is_trading_hours(),
                'server_status': 'healthy'
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

def auth_file_watcher():
    """Watch for auth file updates and initialize Fyers when available."""
    global fyers, fyers_client, access_token
    
    auth_file_path = os.path.join('data', 'fyers_data_auth.json')
    last_modified = 0
    
    while running:
        try:
            if os.path.exists(auth_file_path):
                current_modified = os.path.getmtime(auth_file_path)
                
                if current_modified > last_modified and not fyers:
                    logger.info("🔄 Auth file updated, initializing Fyers...")
                    if initialize_fyers_from_auth_file():
                        # Start Fyers connection
                        fyers.connect()
                        logger.info("✅ Fyers WebSocket connection started")
                    
                    last_modified = current_modified
            
            time.sleep(5)  # Check every 5 seconds
            
        except Exception as e:
            logger.error(f"❌ Error in auth file watcher: {e}")
            time.sleep(5)

def cleanup_disconnected_clients():
    """Periodic cleanup of disconnected clients on both ports."""
    current_time = time.time()
    
    # Cleanup port 5001 clients
    disconnected_clients_5001 = []
    for sid, client_data in clients_5001.items():
        if current_time - client_data.get('last_ping', client_data['connected_at']) > 60:
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
        if time_diff > 60:
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
    """Main function to start both servers."""
    global running
    
    logger.info("=" * 80)
    logger.info("🚀 Starting Unified Fyers Data Server")
    logger.info("📡 Port 5001: Basic Fyers Data Service")
    logger.info("📡 Port 5010: Advanced Live Market Service")
    logger.info("🔄 Authentication: Auto-detect from UI (no waiting)")
    logger.info("=" * 80)
    
    try:
        # Create data directory
        os.makedirs('data', exist_ok=True)
        
        # Load available symbols
        load_available_symbols()
        
        # Try to initialize Fyers from existing auth (no waiting)
        initialize_fyers_from_auth_file()
        
        # Start background tasks
        heartbeat_thread = threading.Thread(target=heartbeat_task, daemon=True)
        heartbeat_thread.start()
        
        auth_watcher_thread = threading.Thread(target=auth_file_watcher, daemon=True)
        auth_watcher_thread.start()
        
        # Start Fyers connection if available
        if fyers:
            fyers_thread = threading.Thread(target=lambda: fyers.connect(), daemon=True)
            fyers_thread.start()
            logger.info("✅ Fyers WebSocket connection started")
        
        # Start periodic cleanup
        def periodic_cleanup():
            while running:
                time.sleep(30)
                try:
                    cleanup_disconnected_clients()
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
        logger.info("🔄 Servers are running and will auto-connect when authentication is available")
        
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
