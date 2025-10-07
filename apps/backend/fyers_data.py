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
    level=logging.WARNING,
    format='%(asctime)s - %(levelname)s - %(message)s',
)
logger = logging.getLogger("FyersServer")

sio = socketio.Server(cors_allowed_origins='*', async_mode='eventlet')
app = socketio.WSGIApp(sio)

client_id = "150HUKJSWG-100"
secret_key = "18YYNXCAS7"
redirect_uri = "https://raghavjaiswal709.github.io/DAKSphere_redirect/"
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

# ============ OPTIMIZED: Real-time Configuration ============
REAL_TIME_INTERVAL = 0.2  # Send updates every 200ms for ultra-smooth charts
CHART_UPDATE_INTERVAL = 0.1  # Chart-specific updates every 100ms
last_emit_time = defaultdict(float)
pending_data = {}
chart_data_queue = defaultdict(deque)  # Queue for chart data

# ============ OPTIMIZED: Enhanced Cached Indicators ============
cached_indicators = {}


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

                if result:
                    calculate_indicators_optimized(symbol, init=True)

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


# ============ OPTIMIZED: Ultra-Fast Real-time Emission ============
def emit_real_time_data():
    """Ultra-fast emission for smooth chart updates"""
    global running
    while running:
        try:
            current_time = time.time()

            for symbol in list(pending_data.keys()):
                if symbol in symbol_to_clients and symbol_to_clients[symbol]:
                    # Check if enough time has passed for real-time updates
                    if current_time - last_emit_time[symbol] >= REAL_TIME_INTERVAL:
                        data = pending_data[symbol].copy()  # Copy to avoid race conditions

                        # Emit to all subscribed clients with high frequency
                        for sid in list(symbol_to_clients[symbol]):
                            try:
                                # Send market data update
                                sio.emit('marketDataUpdate', data, room=sid)

                                # Send chart-specific update with optimized payload
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
                                logger.error(f"Error sending real-time data to client {sid}: {e}")

                        last_emit_time[symbol] = current_time

            # Ultra-fast check cycle
            eventlet.sleep(CHART_UPDATE_INTERVAL)

        except Exception as e:
            logger.error(f"Error in real-time emission: {e}")
            eventlet.sleep(0.1)


def onmessage(message):
    if not isinstance(message, dict) or 'symbol' not in message:
        return

    symbol = message['symbol']

    if message.get('type') == 'sub':
        logger.info(f"Subscription confirmation: {symbol}")
        return

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

    # Store historical data
    store_historical_data(symbol, simplified_data)

    # Calculate indicators with caching
    indicators = calculate_indicators_optimized(symbol)
    if indicators:
        simplified_data.update(indicators)

    # Store for immediate emission
    pending_data[symbol] = simplified_data

    # Add to chart data queue for ultra-smooth updates
    if symbol not in chart_data_queue:
        chart_data_queue[symbol] = deque(maxlen=1000)  # Keep last 1000 points

    chart_data_queue[symbol].append({
        'timestamp': simplified_data['timestamp'],
        'price': simplified_data['ltp'],
        'volume': simplified_data.get('volume', 0)
    })

    # Yield control to prevent blocking
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

    default_symbols = []
    fyers.subscribe(symbols=default_symbols, data_type="SymbolUpdate")
    logger.info(f"Subscribed to default symbols: {default_symbols}")


def heartbeat_task():
    global running
    while running:
        try:
            # Send heartbeat with trading status
            sio.emit('heartbeat', {
                'timestamp': int(time.time()),
                'trading_active': is_trading_hours(),
                'server_time': datetime.datetime.now(INDIA_TZ).isoformat()
            })
            eventlet.sleep(10)  # Heartbeat every 10 seconds
        except Exception as e:
            logger.error(f"Error in heartbeat: {e}")


def main_process():
    global fyers, fyers_client, running

    try:
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
            log_path=None
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

        # Start optimized background tasks
        heartbeat_thread = threading.Thread(target=heartbeat_task, daemon=True)
        heartbeat_thread.start()

        # ============ OPTIMIZED: Start ultra-fast real-time emission ============
        emission_thread = threading.Thread(target=emit_real_time_data, daemon=True)
        emission_thread.start()

        fyers.connect()
        logger.info("Connected to Fyers WebSocket")

        logger.info("Starting optimized Socket.IO server on port 5001...")
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
        logger.info("Shutting down...")
        running = False


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        logger.info("Shutting down...")
        running = False
