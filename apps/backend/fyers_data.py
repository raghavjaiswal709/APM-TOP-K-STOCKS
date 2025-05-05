# import socketio
# import json
# import sys
# import signal
# from fyers_apiv3 import fyersModel
# from fyers_apiv3.FyersWebsocket import data_ws

# # Socket.IO server for communication with NestJS
# sio = socketio.Client()
# connected = False

# # Fyers credentials
# client_id = "150HUKJSWG-100"
# secret_key = "18YYNXCAS7"
# redirect_uri = "https://daksphere.com/"
# response_type = "code"
# grant_type = "authorization_code"

# # Market data storage
# market_data = {}

# # Handle SIGINT (Ctrl+C) gracefully
# def signal_handler(sig, frame):
#     print("Shutting down...")
#     if sio.connected:
#         sio.disconnect()
#     sys.exit(0)

# signal.signal(signal.SIGINT, signal_handler)

# # Socket.IO event handlers
# @sio.event
# def connect():
#     global connected
#     connected = True
#     print("Connected to NestJS backend")

# @sio.event
# def disconnect():
#     global connected
#     connected = False
#     print("Disconnected from NestJS backend")

# @sio.event
# def subscribe(data):
#     symbols = data.get('symbols', [])
#     if hasattr(fyers, 'subscribe') and callable(fyers.subscribe):
#         print(f"Subscribing to symbols: {symbols}")
#         fyers.subscribe(symbols=symbols, data_type="SymbolUpdate")
        
#         # Send any cached data for these symbols
#         for symbol in symbols:
#             if symbol in market_data:
#                 sio.emit('marketData', {'symbol': symbol, 'data': market_data[symbol]})

# @sio.event
# def unsubscribe(data):
#     symbols = data.get('symbols', [])
#     if hasattr(fyers, 'unsubscribe') and callable(fyers.unsubscribe):
#         print(f"Unsubscribing from symbols: {symbols}")
#         fyers.unsubscribe(symbols=symbols, data_type="SymbolUpdate")

# # Fyers WebSocket callbacks
# def onmessage(message):
#     """Handle incoming messages from Fyers WebSocket"""
#     # Check if it's market data
#     # if isinstance(message, dict) and 'symbol' in message and 'ltp' in message:
#     #     symbol = message['symbol']
#     #     data = {
#     #         'ltp': message.get('ltp', 0),
#     #         'change': message.get('ch', 0),
#     #         'changePercent': message.get('chp', 0),
#     #         'open': message.get('open_price', 0),
#     #         'high': message.get('high_price', 0),
#     #         'low': message.get('low_price', 0),
#     #         'close': message.get('prev_close_price', 0),
#     #         'volume': message.get('vol_traded_today', 0),
#     #         'timestamp': message.get('last_traded_time', 0),
#     #         'bid': message.get('bid_price', 0),
#     #         'ask': message.get('ask_price', 0),
#     #     }
        
#     #     # Store data in local cache
#     #     market_data[symbol] = data
        
#     #     # Forward to NestJS if connected
#     #     if connected:
#     #         sio.emit('marketData', {'symbol': symbol, 'data': data})
    
#     # # Log other messages for debugging
#     # elif isinstance(message, dict) and 'type' in message:
#     #     msg_type = message.get('type')
#     #     if msg_type in ['cn', 'sub', 'unsub']:
#     #         print(f"Fyers {msg_type} message: {message.get('message', '')}")


# def onmessage(message):
#     """Handle incoming messages from Fyers WebSocket"""
#     # Forward the raw message exactly as received from Fyers
#     if connected:
#         sio.emit('marketData', message)
    
#     # Also print to console for debugging
#     print("Response:", message)

# def onerror(error):
#     """Handle WebSocket errors"""
#     print(f"Fyers WebSocket error: {error}")
#     if connected:
#         sio.emit('error', {'message': str(error)})

# def onclose(message):
#     """Handle WebSocket close events"""
#     print(f"Fyers WebSocket closed: {message}")
#     if connected:
#         sio.emit('fyersDisconnected', {'message': str(message)})

# def onopen():
#     """Handle WebSocket open events"""
#     print("Fyers WebSocket connected")
#     if connected:
#         sio.emit('fyersConnected', {'status': 'connected'})
    
#     # Subscribe to default symbols
#     default_symbols = ['NSE:ADANIENT-EQ']
#     fyers.subscribe(symbols=default_symbols, data_type="SymbolUpdate")
#     print(f"Subscribed to default symbols: {default_symbols}")

# def main():
#     global fyers
    
#     try:
#         # Connect to NestJS Socket.IO server
#         sio.connect('http://localhost:5001', wait_timeout=10)
        
#         # Create a session model with credentials
#         session = fyersModel.SessionModel(
#             client_id=client_id,
#             secret_key=secret_key,
#             redirect_uri=redirect_uri,
#             response_type=response_type,
#             grant_type=grant_type
#         )
        
#         # Generate auth URL
#         auth_url = session.generate_authcode()
#         print("\n==== Fyers Authentication ====")
#         print("Open this URL in your browser and log in:")
#         print(auth_url)
        
#         # Get auth code from user
#         auth_code = input("\nEnter Auth Code: ")
#         session.set_token(auth_code)
#         token_response = session.generate_token()
        
#         if token_response.get('s') != 'ok':
#             print(f"Authentication failed: {token_response}")
#             sio.disconnect()
#             return
        
#         print("Authentication successful!")
#         access_token = f"{client_id}:{token_response['access_token']}"
        
#         # Create FyersDataSocket instance
#         fyers = data_ws.FyersDataSocket(
#             access_token=access_token,
#             log_path="",
#             litemode=False,
#             write_to_file=False,
#             reconnect=True,
#             on_connect=onopen,
#             on_close=onclose,
#             on_error=onerror,
#             on_message=onmessage
#         )
        
#         # Notify NestJS that we're ready
#         sio.emit('fyersReady', {'status': 'ready'})
        
#         # Connect to Fyers WebSocket
#         fyers.connect()
        
#         # Keep the script running
#         while True:
#             signal.pause()
            
#     except Exception as e:
#         print(f"Error: {e}")
#         if sio.connected:
#             sio.disconnect()

# if __name__ == "__main__":
#     main()

import socketio
import json
import sys
import time
from fyers_apiv3 import fyersModel
from fyers_apiv3.FyersWebsocket import data_ws

# Socket.IO client for communication with NestJS
sio = socketio.Client()
connected = False
running = True  # Flag to control the main loop

# Fyers credentials
client_id = "150HUKJSWG-100"
secret_key = "18YYNXCAS7"
redirect_uri = "https://daksphere.com/"
response_type = "code"
grant_type = "authorization_code"

# Socket.IO event handlers
@sio.event
def connect():
    global connected
    connected = True
    print("Connected to NestJS backend")

@sio.event
def disconnect():
    global connected
    connected = False
    print("Disconnected from NestJS backend")

@sio.event
def subscribe(data):
    symbols = data.get('symbols', [])
    if hasattr(fyers, 'subscribe') and callable(fyers.subscribe):
        print(f"Subscribing to symbols: {symbols}")
        fyers.subscribe(symbols=symbols, data_type="SymbolUpdate")

# Fyers WebSocket callbacks
def onmessage(message):
    """Handle incoming messages from Fyers WebSocket"""
    print("Response:", message)
    
    # Forward to NestJS if connected
    if connected:
        try:
            # For market data updates
            if isinstance(message, dict) and 'symbol' in message and 'ltp' in message:
                sio.emit('marketData', message)
            # For connection/subscription messages
            elif isinstance(message, dict) and 'type' in message:
                sio.emit('fyersMessage', message)
        except Exception as e:
            print(f"Error forwarding message to NestJS: {e}")

def onerror(error):
    """Handle WebSocket errors"""
    print("Error:", error)
    if connected:
        sio.emit('error', {'message': str(error)})

def onclose(message):
    """Handle WebSocket connection close events"""
    print("Connection closed:", message)
    if connected:
        sio.emit('fyersDisconnected', {'message': str(message)})

def onopen():
    """Handle WebSocket open events"""
    print("Fyers WebSocket connected")
    if connected:
        sio.emit('fyersConnected', {'status': 'connected'})
    
    # Subscribe to default symbols
    default_symbols = ['NSE:ADANIENT-EQ']
    fyers.subscribe(symbols=default_symbols, data_type="SymbolUpdate")
    print(f"Subscribed to default symbols: {default_symbols}")

def main():
    global fyers, running
    
    try:
        # Connect to NestJS Socket.IO server
        sio.connect('http://localhost:5001', wait_timeout=10)
        
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
        print("\n==== Fyers Authentication ====")
        print("Open this URL in your browser and log in:")
        print(auth_url)
        
        # Get auth code from user
        auth_code = input("\nEnter Auth Code: ")
        session.set_token(auth_code)
        token_response = session.generate_token()
        
        print("Authentication successful!")
        access_token = f"{client_id}:{token_response['access_token']}"
        
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
        
        # Notify NestJS that we're ready
        sio.emit('fyersReady', {'status': 'ready'})
        
        # Connect to Fyers WebSocket
        fyers.connect()
        
        # Keep the script running with a simple loop instead of signal.pause()
        while running:
            time.sleep(1)  # Sleep for 1 second between iterations
            
    except Exception as e:
        print(f"Error: {e}")
        if sio.connected:
            sio.disconnect()

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("Shutting down...")
        running = False
        if sio.connected:
            sio.disconnect()
