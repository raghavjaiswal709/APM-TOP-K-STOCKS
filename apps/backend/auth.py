"""
Run this script FIRST to authenticate and save the access token.
This avoids eventlet conflicts with requests library.
"""
import json
import datetime
from fyers_apiv3 import fyersModel

# Fyers API credentials
client_id = "150HUKJSWG-100"
secret_key = "18YYNXCAS7"
redirect_uri = "https://raghavjaiswal709.github.io/DAKSphere_redirect/"
response_type = "code"
grant_type = "authorization_code"

def authenticate():
    """Authenticate with Fyers and save token to file."""
    try:
        session = fyersModel.SessionModel(
            client_id=client_id,
            secret_key=secret_key,
            redirect_uri=redirect_uri,
            response_type=response_type,
            grant_type=grant_type
        )
        
        auth_url = session.generate_authcode()
        print("\n" + "="*50)
        print("FYERS AUTHENTICATION")
        print("="*50)
        print("\nStep 1: Open this URL in your browser:")
        print(auth_url)
        print("\nStep 2: Login and authorize the app")
        print("Step 3: Copy the authorization code from redirect URL")
        
        auth_code = input("\nEnter Authorization Code: ").strip()
        
        session.set_token(auth_code)
        token_response = session.generate_token()
        
        if token_response.get('s') != 'ok':
            print(f"\n❌ Authentication failed: {token_response}")
            return False
        
        # Save token with metadata
        token_data = {
            'access_token': token_response['access_token'],
            'generated_at': datetime.datetime.now().isoformat(),
            'client_id': client_id
        }
        
        with open('fyers_token.json', 'w') as f:
            json.dump(token_data, f, indent=2)
        
        print("\n✅ Authentication successful!")
        print(f"Token saved to 'fyers_token.json'")
        print("\nYou can now run the main server script.")
        return True
        
    except Exception as e:
        print(f"\n❌ Error during authentication: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    authenticate()
