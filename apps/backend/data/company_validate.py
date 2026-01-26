#!/usr/bin/env python3
"""
NSE Stock Series Validator with Automatic Token Regeneration
============================================================
This script validates NSE stock series (EQ, BE, BZ, etc.) using the Fyers API.
It automatically regenerates the access token before fetching data.

Author: Senior Python Backend Engineer
Date: December 3, 2025
"""

import os
import sys
import json
import logging
import time
import csv
from datetime import datetime, timezone
from typing import Dict, List, Optional, Tuple
from pathlib import Path
from ratelimit import limits, sleep_and_retry

# Fyers API imports
from fyers_apiv3 import fyersModel

# ============================================================================
# CONFIGURATION
# ============================================================================

# Directory paths (absolute)
BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR
TOKEN_FILE = DATA_DIR / "fyers_data_auth.json"
INPUT_CSV = DATA_DIR / "company_master.csv"
OUTPUT_CSV = DATA_DIR / "company_validated.csv"

# Fyers API credentials
FYERS_CLIENT_ID = "150HUKJSWG-100"
FYERS_SECRET_KEY = "18YYNXCAS7"
FYERS_REDIRECT_URI = "https://google.co.in"

# Series to validate (in priority order)
SERIES_PRIORITY = ['EQ', 'BE', 'BZ', 'SM', 'ST', 'N1', 'N2']

# Rate limiting: 10 calls per 60 seconds (conservative)
RATE_LIMIT_CALLS = 10
RATE_LIMIT_PERIOD = 60

# ============================================================================
# LOGGING SETUP
# ============================================================================

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler(DATA_DIR / 'company_validate.log', mode='a')
    ]
)
logger = logging.getLogger(__name__)

# ============================================================================
# TOKEN MANAGEMENT
# ============================================================================

def load_token_from_file() -> Optional[Dict]:
    """Load the access token from fyers_token.json"""
    try:
        if not TOKEN_FILE.exists():
            logger.error(f"Token file not found: {TOKEN_FILE}")
            return None
        
        with open(TOKEN_FILE, 'r') as f:
            token_data = json.load(f)
        
        logger.info(f"Token loaded from {TOKEN_FILE}")
        return token_data
    except Exception as e:
        logger.error(f"Failed to load token file: {e}")
        return None


def save_token_to_file(token_data: Dict) -> bool:
    """Save the access token to fyers_token.json"""
    try:
        with open(TOKEN_FILE, 'w') as f:
            json.dump(token_data, f, indent=2)
        
        logger.info(f"Token saved to {TOKEN_FILE}")
        return True
    except Exception as e:
        logger.error(f"Failed to save token file: {e}")
        return False


def is_token_valid(token_data: Dict) -> bool:
    """
    Check if the access token is still valid.
    Returns True if token is valid, False otherwise.
    """
    try:
        if not token_data or 'access_token' not in token_data:
            logger.warning("Token data is missing or invalid")
            return False
        
        # Check expiry if present (handle both 'expiry' and 'expires_at' fields)
        expiry_field = token_data.get('expires_at') or token_data.get('expiry')
        if expiry_field:
            expiry_str = expiry_field
            expiry_dt = datetime.fromisoformat(expiry_str.replace('Z', '+00:00'))
            current_dt = datetime.now(timezone.utc)
            
            if current_dt >= expiry_dt:
                logger.warning(f"Token expired at {expiry_str}")
                return False
            
            time_remaining = (expiry_dt - current_dt).total_seconds()
            logger.info(f"Token valid. Time remaining: {time_remaining / 3600:.2f} hours")
        
        # Check is_valid flag
        if 'is_valid' in token_data and not token_data['is_valid']:
            logger.warning("Token marked as invalid")
            return False
        
        return True
    except Exception as e:
        logger.error(f"Error checking token validity: {e}")
        return False


def generate_access_token() -> Optional[str]:
    """
    Generate a new Fyers access token using the SessionModel.
    
    This function handles the OAuth flow:
    1. Generate authorization URL
    2. Wait for user to authenticate and provide auth code
    3. Exchange auth code for access token
    4. Save token to file
    
    Returns:
        str: The access token in format "CLIENT_ID:TOKEN", or None if failed
    """
    try:
        logger.info("=" * 60)
        logger.info("STARTING TOKEN GENERATION PROCESS")
        logger.info("=" * 60)
        
        # Initialize session model
        session = fyersModel.SessionModel(
            client_id=FYERS_CLIENT_ID,
            secret_key=FYERS_SECRET_KEY,
            redirect_uri=FYERS_REDIRECT_URI,
            response_type="code",
            grant_type="authorization_code"
        )
        
        # Generate authorization URL
        auth_url = session.generate_authcode()
        logger.info("\n" + "=" * 60)
        logger.info("AUTHENTICATION REQUIRED")
        logger.info("=" * 60)
        logger.info("Please open this URL in your browser and log in:")
        logger.info(f"\n{auth_url}\n")
        logger.info("=" * 60)
        
        # Wait for user input
        auth_code = input("\nEnter the Auth Code from the redirect URL: ").strip()
        
        if not auth_code:
            logger.error("No auth code provided")
            return None
        
        # Exchange auth code for access token
        logger.info("Exchanging auth code for access token...")
        session.set_token(auth_code)
        token_response = session.generate_token()
        
        # Validate response
        if not token_response or token_response.get('s') != 'ok':
            logger.error(f"Token generation failed: {token_response}")
            return None
        
        logger.info("✓ Token generation successful!")
        
        # Extract token
        raw_token = token_response.get('access_token')
        if not raw_token:
            logger.error("No access token in response")
            return None
        
        # Format: CLIENT_ID:TOKEN
        access_token = f"{FYERS_CLIENT_ID}:{raw_token}"
        
        # Prepare token data for storage
        token_data = {
            "access_token": raw_token,
            "expiry": datetime.now(timezone.utc).replace(hour=18, minute=29, second=0).isoformat(),
            "auth_code": auth_code,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "is_valid": True,
            "last_validated": datetime.now(timezone.utc).isoformat(),
            "session_date": datetime.now(timezone.utc).strftime("%Y-%m-%d")
        }
        
        # Save to file
        if save_token_to_file(token_data):
            logger.info(f"✓ Token saved to {TOKEN_FILE}")
            return access_token
        else:
            logger.error("Failed to save token to file")
            return None
    
    except Exception as e:
        logger.error(f"Token generation failed: {e}")
        import traceback
        traceback.print_exc()
        return None


def ensure_valid_token() -> Optional[str]:
    """
    Ensure a valid access token is available.
    
    This function:
    1. Loads the existing token from file
    2. Checks if it's valid
    3. If invalid or missing, generates a new token
    
    Returns:
        str: Valid access token in format "CLIENT_ID:TOKEN", or None if failed
    """
    logger.info("Checking access token status...")
    
    # Load existing token
    token_data = load_token_from_file()
    
    # Check if token is valid
    if token_data and is_token_valid(token_data):
        logger.info("✓ Existing token is valid")
        access_token = token_data['access_token']
        # If token already has CLIENT_ID prefix, use as-is; otherwise add prefix
        if ':' not in access_token:
            access_token = f"{FYERS_CLIENT_ID}:{access_token}"
        return access_token
    
    # Generate new token
    logger.warning("Token is invalid or missing. Generating new token...")
    access_token = generate_access_token()
    
    if access_token:
        logger.info("✓ New token generated successfully")
        return access_token
    else:
        logger.error("✗ Failed to generate new token")
        return None

# ============================================================================
# FYERS API CLIENT
# ============================================================================

def create_fyers_client(access_token: str) -> fyersModel.FyersModel:
    """
    Create a Fyers API client with the provided access token.
    
    Args:
        access_token: The access token in format "CLIENT_ID:TOKEN"
    
    Returns:
        fyersModel.FyersModel: Configured Fyers client
    """
    try:
        # Extract token without CLIENT_ID prefix
        token_only = access_token.split(':')[1] if ':' in access_token else access_token
        
        fyers_client = fyersModel.FyersModel(
            client_id=FYERS_CLIENT_ID,
            token=token_only,
            log_path=None
        )
        
        logger.info("✓ Fyers client initialized")
        return fyers_client
    except Exception as e:
        logger.error(f"Failed to create Fyers client: {e}")
        raise

# ============================================================================
# SERIES VALIDATION
# ============================================================================

@sleep_and_retry
@limits(calls=RATE_LIMIT_CALLS, period=RATE_LIMIT_PERIOD)
def fetch_quote(fyers_client: fyersModel.FyersModel, symbol: str) -> Optional[Dict]:
    """
    Fetch quote for a given symbol with rate limiting.
    
    Args:
        fyers_client: Configured Fyers client
        symbol: Symbol to fetch (e.g., "NSE:RELIANCE-EQ")
    
    Returns:
        dict: Quote data if successful, None otherwise
    """
    try:
        response = fyers_client.quotes({"symbols": symbol})
        
        if response.get('s') == 'ok' and response.get('d'):
            return response['d'][0]
        else:
            logger.debug(f"Quote fetch failed for {symbol}: {response}")
            return None
    except Exception as e:
        logger.debug(f"Exception fetching quote for {symbol}: {e}")
        return None


def validate_series(fyers_client: fyersModel.FyersModel, company_code: str) -> Tuple[str, str]:
    """
    Validate the series for a given company code.
    
    Tries series in priority order: EQ, BE, BZ, SM, ST, N1, N2
    Returns the first valid series found.
    
    Args:
        fyers_client: Configured Fyers client
        company_code: NSE company code (e.g., "RELIANCE")
    
    Returns:
        tuple: (validated_series, status)
               - validated_series: The valid series (e.g., "EQ") or "STOPPED"
               - status: "SUCCESS" or "FAILED"
    """
    for series in SERIES_PRIORITY:
        symbol = f"NSE:{company_code}-{series}"
        logger.debug(f"Checking {symbol}...")
        
        quote = fetch_quote(fyers_client, symbol)
        
        if quote and quote.get('v'):
            # Quote is valid (has data)
            logger.info(f"✓ Valid series found: {symbol}")
            return series, "SUCCESS"
        
        # Small delay to avoid hammering the API
        time.sleep(0.1)
    
    logger.warning(f"✗ No valid series found for {company_code}")
    return "STOPPED", "FAILED"

# ============================================================================
# CSV PROCESSING
# ============================================================================

def load_company_master() -> List[Dict]:
    """
    Load company_master.csv and filter NSE records.
    
    Returns:
        list: List of NSE company records as dictionaries
    """
    try:
        if not INPUT_CSV.exists():
            logger.error(f"Input file not found: {INPUT_CSV}")
            return []
        
        companies = []
        with open(INPUT_CSV, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                # Filter only NSE records
                if row.get('Exchange', '').upper() == 'NSE':
                    companies.append(row)
        
        logger.info(f"Loaded {len(companies)} NSE companies from {INPUT_CSV}")
        return companies
    except Exception as e:
        logger.error(f"Failed to load company master: {e}")
        return []


def save_validated_companies(companies: List[Dict]) -> bool:
    """
    Save validated companies to company_validated.csv.
    
    Args:
        companies: List of company records with validation results
    
    Returns:
        bool: True if successful, False otherwise
    """
    try:
        if not companies:
            logger.warning("No companies to save")
            return False
        
        # Define output columns
        fieldnames = list(companies[0].keys())
        
        with open(OUTPUT_CSV, 'w', newline='', encoding='utf-8') as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(companies)
        
        logger.info(f"✓ Saved {len(companies)} validated companies to {OUTPUT_CSV}")
        return True
    except Exception as e:
        logger.error(f"Failed to save validated companies: {e}")
        return False

# ============================================================================
# MAIN EXECUTION
# ============================================================================

def main():
    import argparse

    parser = argparse.ArgumentParser(description="NSE Stock Series Validator")
    parser.add_argument("--failed-only", action="store_true", help="Validate only failed subscriptions from failed_subscriptions.json")
    parser.add_argument("--update-master", action="store_true", help="Update company_master.csv in-place")
    args = parser.parse_args()

    start_time = time.time()
    
    logger.info("=" * 60)
    logger.info("NSE STOCK SERIES VALIDATOR")
    logger.info("=" * 60)
    
    # Determine targets
    failed_codes = set()
    if args.failed_only:
        failed_file = DATA_DIR / "failed_subscriptions.json"
        if failed_file.exists():
            try:
                with open(failed_file, 'r') as f:
                    failed_symbols = json.load(f)
                    # Parse codes: "NSE:RELIANCE-EQ" -> "RELIANCE"
                    for s in failed_symbols:
                        if ':' in s and '-' in s:
                            failed_codes.add(s.split(':')[1].split('-')[0])
                        elif '-' in s:
                             failed_codes.add(s.split('-')[0])
                        else:
                             failed_codes.add(s)
                logger.info(f"Loaded {len(failed_codes)} failed company codes to validate.")
            except Exception as e:
                logger.error(f"Error reading failed subscriptions: {e}")
                sys.exit(1)
        else:
             logger.warning("No failed_subscriptions.json found. Validating all.")

    
    # STEP 1: Ensure valid access token
    logger.info("\n[STEP 1/5] Token Authentication")
    logger.info("-" * 60)
    access_token = ensure_valid_token()
    
    if not access_token:
        logger.error("✗ Failed to obtain valid access token. Exiting.")
        sys.exit(1)
    
    logger.info("✓ Token authentication successful")
    
    # STEP 2: Initialize Fyers client
    logger.info("\n[STEP 2/5] Initialize Fyers Client")
    logger.info("-" * 60)
    try:
        fyers_client = create_fyers_client(access_token)
    except Exception as e:
        logger.error(f"✗ Failed to initialize Fyers client: {e}")
        sys.exit(1)
    
    # STEP 3: Load company master
    logger.info("\n[STEP 3/5] Load Company Master")
    logger.info("-" * 60)
    companies = load_company_master()
    
    if not companies:
        logger.error("✗ No NSE companies found in input file. Exiting.")
        sys.exit(1)
    
    # STEP 4: Validate series
    logger.info("\n[STEP 4/5] Validate Series")
    logger.info("-" * 60)
    
    # Track updates: company_code -> new Marker value
    updates = {}
    
    target_companies = []
    if args.failed_only and failed_codes:
        target_indices = [i for i, c in enumerate(companies) if c.get('company_code') in failed_codes]
        logger.info(f"Targeting {len(target_indices)} companies out of {len(companies)}")
    else:
        target_indices = range(len(companies))
    
    success_count = 0
    failed_count = 0
    processed_count = 0
    
    # Track ALL validated companies (not just changes)
    validated_companies = {}
    
    for idx in target_indices:
        company = companies[idx]
        processed_count += 1
        
        company_code = company.get('company_code', 'UNKNOWN')
        company_name = company.get('NAME OF COMPANY', 'Unknown')
        
        logger.info(f"\n[{processed_count}/{len(target_indices)}] {company_code} - {company_name}")
        
        validated_series, status = validate_series(fyers_client, company_code)
        
        # Track ALL validated companies
        old_marker = company.get('Marker', '')
        validated_companies[company_code] = {
            'new_marker': validated_series,
            'old_marker': old_marker,
            'changed': validated_series != old_marker
        }
        
        if validated_series != old_marker:
            updates[company_code] = validated_series
            logger.info(f"  📝 Update: {company_code} Marker '{old_marker}' -> '{validated_series}'")
        else:
            logger.info(f"  ✓ Marker confirmed: {company_code} = '{validated_series}' (no change)")
        
        # Update the company record in memory
        company['Marker'] = validated_series
        
        if status == "SUCCESS":
            success_count += 1
        else:
            failed_count += 1
        
        # Progress report
        if processed_count % 5 == 0:
            logger.info(f"Progress: {processed_count}/{len(target_indices)} | Success: {success_count} | Failed: {failed_count}")

    # STEP 5: Save results
    logger.info("\n[STEP 5/5] Save Results")
    logger.info("-" * 60)
    
    if args.failed_only and args.update_master and validated_companies:
        # Update specific rows in company_master.csv for ALL validated companies
        logger.info(f"Processing {len(validated_companies)} validated entries in {INPUT_CSV}")
        
        try:
            # Read entire CSV
            with open(INPUT_CSV, 'r', newline='', encoding='utf-8') as f:
                reader = csv.DictReader(f)
                fieldnames = reader.fieldnames
                all_rows = list(reader)
            
            # Update the rows for validated companies - ONLY NSE rows
            updated_count = 0
            changed_count = 0
            for row in all_rows:
                code = row.get('company_code', '')
                exchange = row.get('Exchange', '').upper()
                
                # Only update NSE records (we validated NSE symbols)
                if code in validated_companies and exchange == 'NSE':
                    new_marker = validated_companies[code]['new_marker']
                    old_marker = row.get('Marker', '')
                    row['Marker'] = new_marker
                    updated_count += 1
                    if old_marker != new_marker:
                        changed_count += 1
                        logger.info(f"  📝 Changed {exchange}:{code}: '{old_marker}' -> '{new_marker}'")
                    else:
                        logger.info(f"  ✓ Confirmed {exchange}:{code}: '{new_marker}' (validated, no change)")
            
            # Write back
            with open(INPUT_CSV, 'w', newline='', encoding='utf-8') as f:
                writer = csv.DictWriter(f, fieldnames=fieldnames)
                writer.writeheader()
                writer.writerows(all_rows)
            
            logger.info(f"✓ Processed {updated_count} NSE rows in {INPUT_CSV} ({changed_count} actually changed)")
            
        except Exception as e:
            logger.error(f"✗ Failed to update master CSV: {e}")
            sys.exit(1)
    
    elif not args.failed_only:
        # Full validation - write to output file
        output_path = INPUT_CSV if args.update_master else OUTPUT_CSV
        
        try:
            if not companies:
                logger.warning("No companies to save")
            else:
                fieldnames = list(companies[0].keys())
                with open(output_path, 'w', newline='', encoding='utf-8') as f:
                    writer = csv.DictWriter(f, fieldnames=fieldnames)
                    writer.writeheader()
                    writer.writerows(companies)
                logger.info(f"✓ Saved results to {output_path}")
        except Exception as e:
            logger.error(f"✗ Failed to save results: {e}")
            sys.exit(1)
    else:
        logger.info("No validated companies to process")

    # Final summary
    logger.info("\n" + "=" * 60)
    logger.info("VALIDATION SUMMARY")
    logger.info("=" * 60)
    logger.info(f"Total processed: {processed_count}")
    logger.info(f"Success: {success_count}")
    logger.info(f"Failed: {failed_count}")
    if args.failed_only and args.update_master and validated_companies:
        changes = len([v for v in validated_companies.values() if v['changed']])
        logger.info(f"Updated file: {INPUT_CSV}")
        logger.info(f"  - Validated: {len(validated_companies)} companies")
        logger.info(f"  - Changed: {changes} markers")
    elif not args.failed_only:
        logger.info(f"Output file: {INPUT_CSV if args.update_master else OUTPUT_CSV}")
    else:
        logger.info("No file changes made")
    logger.info("=" * 60)

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        logger.warning("\n\n✗ Process interrupted by user")
        sys.exit(1)
    except Exception as e:
        logger.error(f"\n\n✗ Unexpected error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
