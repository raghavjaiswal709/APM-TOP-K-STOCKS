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
from collections import deque
from fyers_apiv3 import fyersModel
from fyers_apiv3.FyersWebsocket import data_ws
import pandas as pd

# Logging configuration
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
)
logger = logging.getLogger("FyersServer")

# Socket.IO setup
sio = socketio.Server(cors_allowed_origins='*', async_mode='eventlet')
app = socketio.WSGIApp(sio)

# Fyers API credentials
client_id = "150HUKJSWG-100"
secret_key = "18YYNXCAS7"
redirect_uri = "https://daksphere.com/"
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
symbols = []
last_tick = {}
MONITORED_FIELDS = [
    'ltp', 'vol_traded_today', 'last_traded_time', 'bid_size', 'ask_size',
    'bid_price', 'ask_price', 'low_price', 'high_price', 'open_price', 'prev_close_price'
]

def load_symbols():
    """Load symbols from NSE_list.csv."""
    global symbols
    try:
        # df = pd.read_csv('NSE_list.csv')
        df = pd.read_csv(os.path.join(os.path.dirname(__file__), 'data', 'watchlists', 'watchlist_A_2025-06-05.csv'))

        symbols = [f"{row['Exchange']}:{row['company_code']}-EQ" for index, row in df.iterrows()]
        logger.info(f"Loaded {len(symbols)} symbols from NSE_list.csv")
    except Exception as e:
        logger.error(f"Error loading symbols: {e}")
        symbols = []

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
        
        parts = symbol.split(':', 1)  # Split only on first colon
        if len(parts) != 2:
            logger.warning(f"Invalid symbol format: {symbol}")
            return None, None
            
        exchange = parts[0]
        code_part = parts[1]
        
        if '-' not in code_part:
            logger.warning(f"Invalid code part (no hyphen): {code_part}")
            return exchange, code_part  # Return what we have
        
        company_code = code_part.split('-')[0]  # Take first part before hyphen
        return exchange, company_code
        
    except Exception as e:
        logger.error(f"Error parsing symbol {symbol}: {e}")
        return None, None

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
        
        if date == now.strftime('%Y-%m-%d') and now < market_close:
            end_time = now
        else:
            end_time = market_close
        
        from_date = market_open.strftime('%Y-%m-%d %H:%M:%S')
        to_date = end_time.strftime('%Y-%m-%d %H:%M:%S')
        
        logger.info(f"Fetching historical data for {symbol} from {from_date} to {to_date}")
        
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
                
                return result
            else:
                logger.error(f"Failed to fetch historical data: {response}")
        
        logger.warning(f"Fyers client not initialized or API call failed for {symbol}")
        return []
        
    except Exception as e:
        logger.error(f"Error fetching historical data: {e}")
        import traceback
        traceback.print_exc()
        return []

def onmessage(message):
    """Handle incoming WebSocket messages and append updates to JSON files."""
    logger.debug(f"Response: {message}")
    
    # Handle subscription confirmations
    if isinstance(message, dict) and message.get('type') == 'sub':
        logger.info(f"Subscription confirmation: {message}")
        return
    
    # Handle connection messages
    if isinstance(message, dict) and message.get('type') in ['cn', 'ful']:
        logger.info(f"Connection message: {message}")
        return
    
    if isinstance(message, dict) and 'symbol' in message:
        symbol = message['symbol']
        
        # Prepare simplified data with all monitored fields
        simplified_data = {
            'symbol': symbol,
            'ltp': message.get('ltp'),
            'vol_traded_today': message.get('vol_traded_today'),
            'last_traded_time': message.get('last_traded_time'),
            'bid_size': message.get('bid_size'),
            'ask_size': message.get('ask_size'),
            'bid_price': message.get('bid_price'),
            'ask_price': message.get('ask_price'),
            'low_price': message.get('low_price'),
            'high_price': message.get('high_price'),
            'open_price': message.get('open_price'),
            'prev_close_price': message.get('prev_close_price'),
            'timestamp': message.get('last_traded_time') or int(time.time())
        }
        
        # Safely parse symbol for file naming
        exchange, company_code = safe_symbol_parse(symbol)
        
        if exchange and company_code:
            # Determine file path
            now = datetime.datetime.now(INDIA_TZ)
            folder = f"LD_{now.strftime('%d-%m-%Y')}"
            os.makedirs(folder, exist_ok=True)
            file_name = f"{company_code}-{exchange}.json"
            file_path = os.path.join(folder, file_name)
            
            # Check for updates in monitored fields
            should_append = (symbol not in last_tick or 
                             any(simplified_data[field] != last_tick[symbol].get(field) 
                                 for field in MONITORED_FIELDS if field in simplified_data))
            
            if should_append:
                try:
                    with open(file_path, 'a') as f:
                        json.dump(simplified_data, f)
                        f.write('\n')
                    logger.debug(f"Appended data to {file_path}")
                    last_tick[symbol] = simplified_data.copy()
                except Exception as e:
                    logger.error(f"Error writing to file {file_path}: {e}")
        else:
            logger.warning(f"Could not parse symbol for file naming: {symbol}")
        
        # Emit to subscribed clients
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

def onopen():
    """Handle WebSocket connection opening and subscribe to all symbols."""
    logger.info("Fyers WebSocket connected")
    sio.emit('fyersConnected', {'status': 'connected'})
    
    if symbols:
        try:
            fyers.subscribe(symbols=symbols, data_type="SymbolUpdate")
            logger.info(f"Subscribed to {len(symbols)} symbols")
        except Exception as e:
            logger.error(f"Error subscribing to symbols: {e}")
    else:
        logger.warning("No symbols loaded for subscription")

def onerror(error):
    logger.error(f"WebSocket Error: {error}")
    sio.emit('error', {'message': str(error)})

def onclose(message):
    logger.info(f"WebSocket Connection closed: {message}")
    sio.emit('fyersDisconnected', {'message': str(message)})

def main_process():
    """Main process to authenticate and start WebSocket connection."""
    global fyers, fyers_client, running
    
    # Load symbols at startup
    load_symbols()
    
    if not symbols:
        logger.error("No symbols loaded. Please check NSE_list.csv file.")
        return
    
    try:
        # Authentication
        session = fyersModel.SessionModel(
            client_id=client_id,
            secret_key=secret_key,
            redirect_uri=redirect_uri,
            response_type=response_type,
            grant_type=grant_type
        )
        
        auth_url = session.generate_authcode()
        logger.info("\n==== Fyers Authentication ====")
        logger.info("Open this URL in your browser and log in:")
        logger.info(auth_url)
        
        auth_code = input("\nEnter Auth Code: ")
        session.set_token(auth_code)
        token_response = session.generate_token()
        
        if token_response.get('s') != 'ok':
            logger.error(f"Authentication failed: {token_response}")
            return
            
        logger.info("Authentication successful!")
        access_token = f"{client_id}:{token_response['access_token']}"
        
        fyers_client = fyersModel.FyersModel(
            client_id=client_id,
            token=token_response['access_token'],
            log_path=""
        )
        
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
        
        fyers.connect()
        logger.info("Connected to Fyers WebSocket")
        
        logger.info("Starting Socket.IO server on port 5010...")
        eventlet.wsgi.server(eventlet.listen(('0.0.0.0', 5010)), app)
        
    except Exception as e:
        logger.error(f"Error in main process: {e}")
        import traceback
        traceback.print_exc()

def main():
    global running
    try:
        eventlet.spawn(main_process)
        while running:
            time.sleep(1)
    except KeyboardInterrupt:
        logger.info("Shutting down...")
        running = False

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        logger.info("Shutting down...")
        running = False