# IMPORTANT: Move eventlet import and monkey patching to the very top
import eventlet
eventlet.monkey_patch()  # Do this before any other imports!

# Now import other modules
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
from collections import deque
from fyers_apiv3 import fyersModel
from fyers_apiv3.FyersWebsocket import data_ws

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
)
logger = logging.getLogger("FyersServer")

# Create a Socket.IO server
sio = socketio.Server(cors_allowed_origins='*', async_mode='eventlet')
app = socketio.WSGIApp(sio)

# Fyers credentials
client_id = "150HUKJSWG-100"
secret_key = "18YYNXCAS7"
redirect_uri = "https://daksphere.com/"
response_type = "code"
grant_type = "authorization_code"

# Track connected clients and their subscriptions
clients = {}
symbol_to_clients = {}
running = True

# Store historical data for each symbol
# We'll store the entire trading day's data (9:30 AM to 3:15 PM)
historical_data = {}
ohlc_data = {}  # Store OHLC data for candlestick charts
MAX_HISTORY_POINTS = 10000  # Limit per symbol to prevent memory issues

# Indian timezone
INDIA_TZ = pytz.timezone('Asia/Kolkata')

# Trading day start and end times (9:30 AM to 3:15 PM, Indian time)
def get_trading_hours():
    now = datetime.datetime.now(INDIA_TZ)
    start_time = now.replace(hour=9, minute=30, second=0, microsecond=0)
    end_time = now.replace(hour=15, minute=15, second=0, microsecond=0)
    return start_time, end_time

def is_trading_hours():
    """Check if current time is within trading hours"""
    now = datetime.datetime.now(INDIA_TZ)
    start_time, end_time = get_trading_hours()
    
    # Only consider weekdays (Monday=0, Sunday=6)
    if now.weekday() >= 5:  # Saturday or Sunday
        return False
    
    return start_time <= now <= end_time

# Socket.IO event handlers
@sio.event
def connect(sid, environ):
    logger.info(f"Client connected: {sid}")
    clients[sid] = {'subscriptions': set()}

@sio.event
def disconnect(sid):
    logger.info(f"Client disconnected: {sid}")
    # Clean up subscriptions for this client
    if sid in clients:
        for symbol in clients[sid]['subscriptions']:
            if symbol in symbol_to_clients:
                symbol_to_clients[symbol].discard(sid)
        del clients[sid]

@sio.event
def subscribe(sid, data):
    symbol = data.get('symbol')
    if not symbol:
        return {'success': False, 'error': 'No symbol provided'}
    
    logger.info(f"Client {sid} subscribing to {symbol}")
    
    # Track this subscription
    clients[sid]['subscriptions'].add(symbol)
    if symbol not in symbol_to_clients:
        symbol_to_clients[symbol] = set()
    symbol_to_clients[symbol].add(sid)
    
    # Subscribe to Fyers if we have an active connection
    if hasattr(fyers, 'subscribe') and callable(fyers.subscribe):
        logger.info(f"Subscribing to symbol: {symbol}")
        fyers.subscribe(symbols=[symbol], data_type="SymbolUpdate")
    
    # Send historical data for this symbol if available
    if symbol in historical_data and historical_data[symbol]:
        logger.info(f"Sending historical data for {symbol} to client {sid}")
        # Convert deque to list for serialization
        hist_data_list = list(historical_data[symbol])
        sio.emit('historicalData', {
            'symbol': symbol,
            'data': hist_data_list
        }, room=sid)
    
    # Send OHLC data for candlestick chart
    if symbol in ohlc_data and ohlc_data[symbol]:
        logger.info(f"Sending OHLC data for {symbol} to client {sid}")
        sio.emit('ohlcData', {
            'symbol': symbol,
            'data': list(ohlc_data[symbol])
        }, room=sid)
    
    return {'success': True, 'symbol': symbol}

@sio.event
def unsubscribe(sid, data):
    symbol = data.get('symbol')
    if not symbol:
        return {'success': False, 'error': 'No symbol provided'}
    
    logger.info(f"Client {sid} unsubscribing from {symbol}")
    
    # Remove from tracking
    if sid in clients:
        clients[sid]['subscriptions'].discard(symbol)
    
    if symbol in symbol_to_clients:
        symbol_to_clients[symbol].discard(sid)
        
        # If no clients are subscribed to this symbol, unsubscribe from Fyers
        if not symbol_to_clients[symbol] and hasattr(fyers, 'unsubscribe'):
            logger.info(f"No more clients for {symbol}, unsubscribing from Fyers")
            fyers.unsubscribe(symbols=[symbol])
    
    return {'success': True, 'symbol': symbol}

@sio.event
def get_trading_status(sid, data):
    """Return current trading status and hours"""
    start_time, end_time = get_trading_hours()
    return {
        'trading_active': is_trading_hours(),
        'trading_start': start_time.isoformat(),
        'trading_end': end_time.isoformat(),
        'current_time': datetime.datetime.now(INDIA_TZ).isoformat(),
        'is_market_day': datetime.datetime.now(INDIA_TZ).weekday() < 5
    }

# Function to store historical data
def store_historical_data(symbol, data_point):
    """Store historical data for a symbol"""
    if symbol not in historical_data:
        historical_data[symbol] = deque(maxlen=MAX_HISTORY_POINTS)
    
    # Add timestamp if not present
    if 'timestamp' not in data_point:
        data_point['timestamp'] = int(time.time())
    
    # Store the data point
    historical_data[symbol].append(data_point)
    
    # Update OHLC data for candlestick chart
    update_ohlc_data(symbol, data_point)

def update_ohlc_data(symbol, data_point):
    """Update OHLC (Open, High, Low, Close) data for candlestick charts"""
    if symbol not in ohlc_data:
        ohlc_data[symbol] = deque(maxlen=MAX_HISTORY_POINTS)
    
    timestamp = data_point['timestamp']
    price = data_point['ltp']
    
    # Round timestamp to the nearest minute for 1-minute candles
    minute_timestamp = (timestamp // 60) * 60
    
    # Check if we need to create a new candle or update existing one
    if not ohlc_data[symbol] or ohlc_data[symbol][-1]['timestamp'] < minute_timestamp:
        # Create a new candle
        ohlc_data[symbol].append({
            'timestamp': minute_timestamp,
            'open': price,
            'high': price,
            'low': price,
            'close': price,
            'volume': data_point.get('volume', 0)
        })
    else:
        # Update the current candle
        current_candle = ohlc_data[symbol][-1]
        current_candle['high'] = max(current_candle['high'], price)
        current_candle['low'] = min(current_candle['low'], price)
        current_candle['close'] = price
        current_candle['volume'] = data_point.get('volume', current_candle['volume'])

# Calculate technical indicators
def calculate_indicators(symbol):
    """Calculate technical indicators for a symbol"""
    if symbol not in ohlc_data or len(ohlc_data[symbol]) < 20:
        return {}
    
    # Extract price data
    closes = [candle['close'] for candle in ohlc_data[symbol]]
    
    # Calculate SMA-20
    sma_20 = np.mean(closes[-20:])
    
    # Calculate EMA-9
    ema_9 = closes[-1]
    alpha = 2 / (9 + 1)
    for i in range(2, min(10, len(closes) + 1)):
        ema_9 = alpha * closes[-i] + (1 - alpha) * ema_9
    
    # Calculate RSI-14
    changes = [closes[i] - closes[i-1] for i in range(1, len(closes))]
    gains = [max(0, change) for change in changes]
    losses = [max(0, -change) for change in changes]
    
    if len(gains) >= 14:
        avg_gain = np.mean(gains[-14:])
        avg_loss = np.mean(losses[-14:])
        
        if avg_loss == 0:
            rsi = 100
        else:
            rs = avg_gain / avg_loss
            rsi = 100 - (100 / (1 + rs))
    else:
        rsi = 50  # Default value if not enough data
    
    return {
        'sma_20': sma_20,
        'ema_9': ema_9,
        'rsi_14': rsi
    }

# Fyers WebSocket callbacks
def onmessage(message):
    """Handle incoming messages from Fyers WebSocket"""
    logger.debug(f"Response: {message}")
    
    # Check if this is a subscription confirmation message
    if isinstance(message, dict) and message.get('type') == 'sub':
        logger.info(f"Subscription confirmation: {message}")
        return
    
    # Forward to clients subscribed to this symbol
    if isinstance(message, dict) and 'symbol' in message:
        symbol = message['symbol']
        
        # Create a simplified data structure for clients
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
        
        # Store for historical data
        store_historical_data(symbol, simplified_data)
        
        # Calculate indicators periodically
        indicators = calculate_indicators(symbol)
        if indicators:
            simplified_data.update(indicators)
        
        # Send to subscribed clients
        if symbol in symbol_to_clients:
            for sid in symbol_to_clients[symbol]:
                try:
                    sio.emit('marketData', simplified_data, room=sid)
                except Exception as e:
                    logger.error(f"Error sending data to client {sid}: {e}")
        else:
            logger.debug(f"No clients subscribed to {symbol}")
    else:
        logger.warning(f"Invalid message format: {message}")

def onerror(error):
    """Handle WebSocket errors"""
    logger.error(f"Error: {error}")
    # Broadcast error to all clients
    sio.emit('error', {'message': str(error)})

def onclose(message):
    """Handle WebSocket connection close events"""
    logger.info(f"Connection closed: {message}")
    sio.emit('fyersDisconnected', {'message': str(message)})

def onopen():
    """Handle WebSocket open events"""
    logger.info("Fyers WebSocket connected")
    sio.emit('fyersConnected', {'status': 'connected'})
    
    # Subscribe to default symbols
    default_symbols = ['NSE:ADANIENT-EQ']
    fyers.subscribe(symbols=default_symbols, data_type="SymbolUpdate")
    logger.info(f"Subscribed to default symbols: {default_symbols}")

def heartbeat_task():
    """Send heartbeat to all clients every 30 seconds"""
    while running:
        try:
            sio.emit('heartbeat', {
                'timestamp': int(time.time()),
                'trading_active': is_trading_hours()
            })
            time.sleep(30)
        except Exception as e:
            logger.error(f"Error in heartbeat: {e}")

# Generate sample historical data for testing
def generate_sample_historical_data(symbol):
    """Generate sample historical data for a symbol"""
    if symbol not in historical_data:
        historical_data[symbol] = deque(maxlen=MAX_HISTORY_POINTS)
    
    if symbol not in ohlc_data:
        ohlc_data[symbol] = deque(maxlen=MAX_HISTORY_POINTS)
    
    # Get current date
    now = datetime.datetime.now(INDIA_TZ)
    
    # Start from 9:30 AM
    start_time = now.replace(hour=9, minute=30, second=0, microsecond=0)
    
    # End at current time or 3:15 PM, whichever is earlier
    current_time = now
    end_time = now.replace(hour=15, minute=15, second=0, microsecond=0)
    
    if current_time > end_time:
        current_time = end_time
    
    # Generate data points every minute
    current = start_time
    base_price = 2200.0  # Base price for ADANIENT
    
    # Generate minute-by-minute data
    while current <= current_time:
        # Generate a random price movement with some trend
        minute_of_day = current.hour * 60 + current.minute
        trend_factor = np.sin(minute_of_day / 180 * np.pi) * 20  # Sinusoidal trend
        noise = (hash(str(current)) % 100 - 50) / 5.0  # Random noise
        
        price = base_price + trend_factor + noise
        price = max(price, base_price * 0.9)  # Ensure price doesn't go too low
        
        # Create a data point for line chart
        data_point = {
            'symbol': symbol,
            'ltp': price,
            'change': price - base_price,
            'changePercent': ((price - base_price) / base_price) * 100,
            'volume': hash(str(current)) % 10000 + 5000,
            'open': base_price - 5,
            'high': base_price + 10,
            'low': base_price - 10,
            'close': base_price,
            'timestamp': int(current.timestamp())
        }
        
        # Store the data point
        historical_data[symbol].append(data_point)
        
        # Create OHLC data for candlestick chart (1-minute candles)
        minute_timestamp = int(current.timestamp())
        
        # Add some randomness to OHLC data
        open_price = price - (hash(str(current) + "open") % 10 - 5)
        high_price = max(price, open_price) + (hash(str(current) + "high") % 10)
        low_price = min(price, open_price) - (hash(str(current) + "low") % 10)
        close_price = price
        
        ohlc_data[symbol].append({
            'timestamp': minute_timestamp,
            'open': open_price,
            'high': high_price,
            'low': low_price,
            'close': close_price,
            'volume': data_point['volume']
        })
        
        # Move to next minute
        current += datetime.timedelta(minutes=1)
    
    logger.info(f"Generated {len(historical_data[symbol])} sample data points for {symbol}")
    logger.info(f"Generated {len(ohlc_data[symbol])} OHLC candles for {symbol}")

def main():
    global fyers, running
    
    try:
        # Create a session model with credentials
        session = fyersModel.SessionModel(
            client_id=client_id,
            secret_key=secret_key,
            redirect_uri=redirect_uri,
            response_type=response_type,
            grant_type=grant_type
        )
        
        # Generate auth URL
        auth_url = session.generate_authcode()
        logger.info("\n==== Fyers Authentication ====")
        logger.info("Open this URL in your browser and log in:")
        logger.info(auth_url)
        
        # Get auth code from user
        auth_code = input("\nEnter Auth Code: ")
        session.set_token(auth_code)
        token_response = session.generate_token()
        
        if token_response.get('s') != 'ok':
            logger.error(f"Authentication failed: {token_response}")
            return
            
        logger.info("Authentication successful!")
        access_token = f"{client_id}:{token_response['access_token']}"
        
        # Generate sample historical data for default symbols
        generate_sample_historical_data('NSE:ADANIENT-EQ')
        
        # Create FyersDataSocket instance
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
        
        # Start heartbeat thread
        heartbeat_thread = threading.Thread(target=heartbeat_task, daemon=True)
        heartbeat_thread.start()
        
        # Connect to Fyers WebSocket
        fyers.connect()
        logger.info("Connected to Fyers WebSocket")
        
        # Start the Socket.IO server
        logger.info("Starting Socket.IO server on port 5001...")
        eventlet.wsgi.server(eventlet.listen(('0.0.0.0', 5001)), app)
        
    except Exception as e:
        logger.error(f"Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        logger.info("Shutting down...")
        running = False
