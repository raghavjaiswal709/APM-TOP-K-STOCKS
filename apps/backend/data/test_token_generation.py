#!/usr/bin/env python3
"""
Token Generation Test Script
============================
Quick test to verify token generation works correctly.
"""

import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent))

from company_validate import (
    ensure_valid_token,
    load_token_from_file,
    is_token_valid,
    logger
)

def main():
    print("=" * 60)
    print("TOKEN GENERATION TEST")
    print("=" * 60)
    
    # Test 1: Load existing token
    print("\n[Test 1] Loading existing token...")
    token_data = load_token_from_file()
    if token_data:
        print(f"✓ Token loaded successfully")
        print(f"  - Created: {token_data.get('created_at', 'Unknown')}")
        print(f"  - Expiry: {token_data.get('expiry', 'Unknown')}")
        print(f"  - Valid: {token_data.get('is_valid', False)}")
    else:
        print("✗ No token found")
    
    # Test 2: Validate token
    print("\n[Test 2] Validating token...")
    if token_data:
        is_valid = is_token_valid(token_data)
        if is_valid:
            print("✓ Token is valid")
        else:
            print("✗ Token is invalid or expired")
    
    # Test 3: Ensure valid token (may trigger regeneration)
    print("\n[Test 3] Ensuring valid token...")
    print("Note: This may prompt for authentication if token is invalid")
    print("-" * 60)
    
    access_token = ensure_valid_token()
    
    if access_token:
        print("\n✓ Token ready for use")
        print(f"  - Format: {access_token[:20]}...{access_token[-20:]}")
        print("\n" + "=" * 60)
        print("SUCCESS: All tests passed!")
        print("=" * 60)
        return 0
    else:
        print("\n✗ Failed to obtain valid token")
        print("=" * 60)
        print("FAILURE: Token generation failed")
        print("=" * 60)
        return 1

if __name__ == "__main__":
    try:
        exit_code = main()
        sys.exit(exit_code)
    except KeyboardInterrupt:
        print("\n\nTest interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n✗ Test failed with error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
