#!/usr/bin/env python3
"""
Fyers Token Generation Helper
This script helps you generate and update the Fyers authentication token.
"""

import json
import os
from datetime import datetime
import base64

def decode_jwt(token_string):
    """Decode JWT token to check expiry"""
    try:
        # Extract the JWT part (after client_id:)
        if ':' in token_string:
            jwt = token_string.split(':')[1]
        else:
            jwt = token_string
        
        # Decode the payload
        parts = jwt.split('.')
        if len(parts) < 2:
            return None
        
        payload = parts[1]
        # Add padding
        padding = 4 - len(payload) % 4
        if padding != 4:
            payload += '=' * padding
        
        decoded = json.loads(base64.b64decode(payload))
        return decoded
    except Exception as e:
        print(f"Error decoding JWT: {e}")
        return None

def check_token_status(auth_file='data/fyers_data_auth.json'):
    """Check if token is expired"""
    if not os.path.exists(auth_file):
        print(f"❌ Auth file not found: {auth_file}")
        return None
    
    try:
        with open(auth_file, 'r') as f:
            auth_data = json.load(f)
        
        access_token = auth_data.get('access_token', '')
        decoded = decode_jwt(access_token)
        
        if not decoded:
            print("❌ Could not decode token")
            return None
        
        exp_timestamp = decoded['exp']
        iat_timestamp = decoded['iat']
        
        from datetime import datetime
        exp_time = datetime.fromtimestamp(exp_timestamp)
        iat_time = datetime.fromtimestamp(iat_timestamp)
        current_time = datetime.now()
        
        print(f"\n📋 Token Status:")
        print(f"   Issued: {iat_time}")
        print(f"   Expires: {exp_time}")
        print(f"   Current: {current_time}")
        print(f"   Status: {'✅ VALID' if current_time < exp_time else '❌ EXPIRED'}")
        
        return decoded
        
    except Exception as e:
        print(f"❌ Error: {e}")
        return None

def update_auth_file(new_token, auth_file='data/fyers_data_auth.json'):
    """Update the auth file with a new token"""
    try:
        with open(auth_file, 'r') as f:
            auth_data = json.load(f)
        
        # Update the access token
        auth_data['access_token'] = new_token
        auth_data['timestamp'] = datetime.now().isoformat() + 'Z'
        
        with open(auth_file, 'w') as f:
            json.dump(auth_data, f, indent=2)
        
        print(f"✅ Auth file updated: {auth_file}")
        print(f"\n📋 New Token Status:")
        check_token_status(auth_file)
        
    except Exception as e:
        print(f"❌ Error updating auth file: {e}")

if __name__ == '__main__':
    import sys
    
    if len(sys.argv) > 1 and sys.argv[1] == 'update':
        if len(sys.argv) < 3:
            print("Usage: python3 generate_fyers_token.py update <new_token>")
            sys.exit(1)
        new_token = sys.argv[2]
        update_auth_file(new_token)
    else:
        print("🔍 Checking current Fyers token status...\n")
        check_token_status()
        print("\n📌 To update token, run:")
        print("   python3 apps/backend/generate_fyers_token.py update <your_new_token>")
