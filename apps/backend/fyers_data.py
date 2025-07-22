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

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
)
logger = logging.getLogger("FyersServer")

sio = socketio.Server(cors_allowed_origins='*', async_mode='eventlet')
app = socketio.WSGIApp(sio)

client_id = "150HUKJSWG-100"
secret_key = "18YYNXCAS7"
redirect_uri = "https://daksphere.com/"
response_type = "code"
grant_type = "authorization_code"

clients = {}
symbol_to_clients = {}
running = True

historical_data = {}
ohlc_data = {}
MAX_HISTORY_POINTS = 10000

INDIA_TZ = pytz.timezone('Asia/Kolkata')

fyers = None
fyers_client = None

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

def fetch_daily_historical_data(symbol, days=30):
    try:
        if not fyers_client:
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
    
    logger.info(f"Client {sid} subscribing to {symbol}")
    
    clients[sid]['subscriptions'].add(symbol)
    if symbol not in symbol_to_clients:
        symbol_to_clients[symbol] = set()
    symbol_to_clients[symbol].add(sid)
    
    if symbol not in historical_data or not historical_data[symbol]:
        logger.info(f"Fetching historical data for {symbol}")
        hist_data = fetch_historical_intraday_data(symbol)
        
        if symbol not in historical_data:
            historical_data[symbol] = deque(maxlen=MAX_HISTORY_POINTS)
        
        for data_point in hist_data:
            historical_data[symbol].append(data_point)
    
    if hasattr(fyers, 'subscribe') and callable(fyers.subscribe):
        logger.info(f"Subscribing to symbol: {symbol}")
        fyers.subscribe(symbols=[symbol], data_type="SymbolUpdate")
    
    if symbol in historical_data and historical_data[symbol]:
        logger.info(f"Sending historical data for {symbol} to client {sid}")
        hist_data_list = list(historical_data[symbol])
        sio.emit('historicalData', {
            'symbol': symbol,
            'data': hist_data_list
        }, room=sid)
    
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
    
    if sid in clients:
        clients[sid]['subscriptions'].discard(symbol)
    
    if symbol in symbol_to_clients:
        symbol_to_clients[symbol].discard(sid)
        
        if not symbol_to_clients[symbol] and hasattr(fyers, 'unsubscribe'):
            logger.info(f"No more clients for {symbol}, unsubscribing from Fyers")
            fyers.unsubscribe(symbols=[symbol])
    
    return {'success': True, 'symbol': symbol}

@sio.event
def get_trading_status(sid, data):
    start_time, end_time = get_trading_hours()
    return {
        'trading_active': is_trading_hours(),
        'trading_start': start_time.isoformat(),
        'trading_end': end_time.isoformat(),
        'current_time': datetime.datetime.now(INDIA_TZ).isoformat(),
        'is_market_day': datetime.datetime.now(INDIA_TZ).weekday() < 5
    }

@sio.event
def get_historical_data_for_date(sid, data):
    symbol = data.get('symbol')
    date = data.get('date')
    
    if not symbol:
        return {'success': False, 'error': 'No symbol provided'}
    
    if not date:
        date = datetime.datetime.now(INDIA_TZ).strftime('%Y-%m-%d')
    
    try:
        # try:
        #     with open(f'market_data_{date}_{symbol}.json', 'r') as f:
        #         saved_data = json.load(f)
        #         logger.info(f"Loaded saved data for {symbol} on {date}")
        #         return {
        #             'success': True,
        #             'symbol': symbol,
        #             'date': date,
        #             'data': saved_data
        #         }
        # except FileNotFoundError:
        #     pass
        
        hist_data = fetch_historical_intraday_data(symbol, date)
        
        # if hist_data:
        #     try:
        #         with open(f'market_data_{date}_{symbol}.json', 'w') as f:
        #             json.dump(hist_data, f)
        #         logger.info(f"Saved historical data for {symbol} on {date}")
        #     except Exception as e:
        #         logger.error(f"Error saving historical data: {e}")
        
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
    if symbol not in historical_data:
        historical_data[symbol] = deque(maxlen=MAX_HISTORY_POINTS)
    
    if 'timestamp' not in data_point:
        data_point['timestamp'] = int(time.time())
    
    historical_data[symbol].append(data_point)
    
    update_ohlc_data(symbol, data_point)

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

def calculate_indicators(symbol):
    if symbol not in ohlc_data or len(ohlc_data[symbol]) < 20:
        return {}
    
    closes = [candle['close'] for candle in ohlc_data[symbol]]
    
    sma_20 = np.mean(closes[-20:])
    
    ema_9 = closes[-1]
    alpha = 2 / (9 + 1)
    for i in range(2, min(10, len(closes) + 1)):
        ema_9 = alpha * closes[-i] + (1 - alpha) * ema_9
    
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
        rsi = 50
    
    return {
        'sma_20': sma_20,
        'ema_9': ema_9,
        'rsi_14': rsi
    }

def onmessage(message):
    logger.debug(f"Response: {message}")
    
    if isinstance(message, dict) and message.get('type') == 'sub':
        logger.info(f"Subscription confirmation: {message}")
        return
    
    if isinstance(message, dict) and 'symbol' in message:
        symbol = message['symbol']
        
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
        
        store_historical_data(symbol, simplified_data)
        
        indicators = calculate_indicators(symbol)
        if indicators:
            simplified_data.update(indicators)
        
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
    logger.error(f"Error: {error}")
    sio.emit('error', {'message': str(error)})

def onclose(message):
    logger.info(f"Connection closed: {message}")
    sio.emit('fyersDisconnected', {'message': str(message)})

def onopen():
    logger.info("Fyers WebSocket connected")
    sio.emit('fyersConnected', {'status': 'connected'})
    
    default_symbols = []
    fyers.subscribe(symbols=default_symbols, data_type="SymbolUpdate")
    logger.info(f"Subscribed to default symbols: {default_symbols}")

def heartbeat_task():
    global running
    while running:
        try:
            sio.emit('heartbeat', {
                'timestamp': int(time.time()),
                'trading_active': is_trading_hours()
            })
            time.sleep(30)
        except Exception as e:
            logger.error(f"Error in heartbeat: {e}")

def save_daily_data():
    today = datetime.datetime.now(INDIA_TZ).strftime('%Y-%m-%d')
    
    for symbol in historical_data:
        data_to_save = list(historical_data[symbol])
        
        try:
            with open(f'market_data_{today}_{symbol}.json', 'w') as f:
                json.dump(data_to_save, f)
            logger.info(f"Saved market data for {symbol} on {today}")
        except Exception as e:
            logger.error(f"Error saving market data for {symbol}: {e}")
    
    for symbol in ohlc_data:
        ohlc_to_save = list(ohlc_data[symbol])
        
        try:
            with open(f'ohlc_data_{today}_{symbol}.json', 'w') as f:
                json.dump(ohlc_to_save, f)
            logger.info(f"Saved OHLC data for {symbol} on {today}")
        except Exception as e:
            logger.error(f"Error saving OHLC data for {symbol}: {e}")

def load_daily_data():
    today = datetime.datetime.now(INDIA_TZ).strftime('%Y-%m-%d')
    
    for file in os.listdir('.'):
        if file.startswith('market_data_' + today) and file.endswith('.json'):
            symbol = file.replace('market_data_' + today + '_', '').replace('.json', '')
            
            try:
                with open(file, 'r') as f:
                    data_points = json.load(f)
                    
                    if symbol not in historical_data:
                        historical_data[symbol] = deque(maxlen=MAX_HISTORY_POINTS)
                    
                    for point in data_points:
                        historical_data[symbol].append(point)
                    
                    logger.info(f"Loaded {len(data_points)} historical data points for {symbol}")
            except Exception as e:
                logger.error(f"Error loading market data for {symbol}: {e}")
    
    for file in os.listdir('.'):
        if file.startswith('ohlc_data_' + today) and file.endswith('.json'):
            symbol = file.replace('ohlc_data_' + today + '_', '').replace('.json', '')
            
            try:
                with open(file, 'r') as f:
                    candles = json.load(f)
                    
                    if symbol not in ohlc_data:
                        ohlc_data[symbol] = deque(maxlen=MAX_HISTORY_POINTS)
                    
                    for candle in candles:
                        ohlc_data[symbol].append(candle)
                    
                    logger.info(f"Loaded {len(candles)} OHLC candles for {symbol}")
            except Exception as e:
                logger.error(f"Error loading OHLC data for {symbol}: {e}")

# def data_persistence_task():
#     global running
#     while running:
#         try:
#             save_daily_data()
#             time.sleep(300)
#         except Exception as e:
#             logger.error(f"Error in data persistence task: {e}")

def cleanup_old_data_files():
    try:
        today = datetime.datetime.now(INDIA_TZ)
        for file in os.listdir('.'):
            if (file.startswith('market_data_') or file.startswith('ohlc_data_')) and file.endswith('.json'):
                try:
                    date_str = file.split('_')[2]
                    file_date = datetime.datetime.strptime(date_str, '%Y-%m-%d')
                    if (today - file_date).days > 30:
                        os.remove(file)
                        logger.info(f"Removed old data file: {file}")
                except (ValueError, IndexError):
                    continue
    except Exception as e:
        logger.error(f"Error cleaning up old data files: {e}")

def main_process():
    global fyers, fyers_client, running
    
    try:
        # load_daily_data()
        
        cleanup_old_data_files()
        
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
        
        heartbeat_thread = threading.Thread(target=heartbeat_task, daemon=True)
        heartbeat_thread.start()
        
        # persistence_thread = threading.Thread(target=data_persistence_task, daemon=True)
        # persistence_thread.start()
        
        def schedule_end_of_day_save():
            now = datetime.datetime.now(INDIA_TZ)
            market_close = now.replace(hour=15, minute=30, second=0, microsecond=0)
            
            if now < market_close:
                delay = (market_close - now).total_seconds()
                threading.Timer(delay, save_daily_data).start()
                logger.info(f"Scheduled end-of-day data save for {market_close.strftime('%H:%M:%S')}")
        
        # schedule_end_of_day_save()
        
        fyers.connect()
        logger.info("Connected to Fyers WebSocket")
        
        logger.info("Starting Socket.IO server on port 5001...")
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
            time.sleep(1)
    except KeyboardInterrupt:
        logger.info("Shutting down...")
        running = False
        # save_daily_data()

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        logger.info("Shutting down...")
        running = False
        save_daily_data()
