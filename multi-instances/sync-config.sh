#!/bin/bash
# Sync Configuration Script for Multi-Instances
# This script copies the main .env configurations to all instances
# Run this from the APM-TOP-K-STOCKS root directory

set -e

# Change to repository root directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."

echo "🔄 Syncing configurations to multi-instances..."
echo "   Working from: $(pwd)"
echo ""

# Source directories
BACKEND_DATA="apps/backend/data"
BACKEND_ENV="apps/backend/.env"

# Files to sync
AUTH_FILES=(
    "fyers_data_auth.json"
    "fyers_token.json"
    "multi_company_live_data_auth.json"
    "auth_status.json"
)

DATA_FILES=(
    "company_master.csv"
    "company_validated.csv"
)

# Instance directories
INSTANCES=("multi-instances/instance1" "multi-instances/instance2" "multi-instances/instance3")

# Track errors
ERRORS=0
MISSING_FILES=()

# Check if source files exist
echo "📋 Checking source files..."
for FILE in "${AUTH_FILES[@]}" "${DATA_FILES[@]}"; do
    if [ ! -f "$BACKEND_DATA/$FILE" ]; then
        echo "   ❌ MISSING: $BACKEND_DATA/$FILE"
        MISSING_FILES+=("$FILE")
        ERRORS=$((ERRORS + 1))
    else
        echo "   ✅ Found: $FILE"
    fi
done
echo ""

if [ ${#MISSING_FILES[@]} -gt 0 ]; then
    echo "⚠️  WARNING: ${#MISSING_FILES[@]} source file(s) are missing!"
    echo "   The following files will not be copied:"
    for FILE in "${MISSING_FILES[@]}"; do
        echo "     - $FILE"
    done
    echo ""
fi

# Sync to each instance
for INSTANCE in "${INSTANCES[@]}"; do
    echo "📂 Syncing to $INSTANCE..."
    
    # Create data directory if it doesn't exist
    mkdir -p "$INSTANCE/data"
    
    # Copy authentication files
    COPIED=0
    for FILE in "${AUTH_FILES[@]}"; do
        if [ -f "$BACKEND_DATA/$FILE" ]; then
            cp -f "$BACKEND_DATA/$FILE" "$INSTANCE/data/"
            COPIED=$((COPIED + 1))
        fi
    done
    
    # Copy data files
    for FILE in "${DATA_FILES[@]}"; do
        if [ -f "$BACKEND_DATA/$FILE" ]; then
            cp -f "$BACKEND_DATA/$FILE" "$INSTANCE/data/"
            COPIED=$((COPIED + 1))
        fi
    done
    
    # ✅ SMART ENV UPDATE: Update Fyers credentials only
    # Preserves instance-specific config (PORTS, INSTANCE_ID)
    if [ -f "$BACKEND_ENV" ] && [ -f "$INSTANCE/.env" ]; then
        # Read credentials from backend
        FYERS_CLIENT_ID=$(grep "^FYERS_CLIENT_ID=" "$BACKEND_ENV" 2>/dev/null | cut -d'=' -f2 || echo "")
        FYERS_SECRET_ID=$(grep "^FYERS_SECRET_ID=" "$BACKEND_ENV" 2>/dev/null | cut -d'=' -f2 || echo "")
        FYERS_REDIRECT_URI=$(grep "^FYERS_REDIRECT_URI=" "$BACKEND_ENV" 2>/dev/null | cut -d'=' -f2 || echo "")
        FYERS_ACCESS_TOKEN=$(grep "^FYERS_ACCESS_TOKEN=" "$BACKEND_ENV" 2>/dev/null | cut -d'=' -f2 || echo "")
        
        # Backup before SED
        cp -f "$INSTANCE/.env" "$INSTANCE/.env.bak"
        
        UPDATED=0
        if [ -n "$FYERS_CLIENT_ID" ]; then
            # Use strict regex to replace only the values
            # Escape special characters if needed (assuming standard alphanumeric tokens)
            sed -i.tmp "s|^FYERS_CLIENT_ID=.*|FYERS_CLIENT_ID=$FYERS_CLIENT_ID|" "$INSTANCE/.env" && rm "$INSTANCE/.env.tmp"
            sed -i.tmp "s|^FYERS_SECRET_ID=.*|FYERS_SECRET_ID=$FYERS_SECRET_ID|" "$INSTANCE/.env" && rm "$INSTANCE/.env.tmp"
            # URI might have slashes, use alternate delimiter |
            sed -i.tmp "s|^FYERS_REDIRECT_URI=.*|FYERS_REDIRECT_URI=$FYERS_REDIRECT_URI|" "$INSTANCE/.env" && rm "$INSTANCE/.env.tmp"
            sed -i.tmp "s|^FYERS_ACCESS_TOKEN=.*|FYERS_ACCESS_TOKEN=$FYERS_ACCESS_TOKEN|" "$INSTANCE/.env" && rm "$INSTANCE/.env.tmp"
            
            UPDATED=1
        fi
        
        if [ $UPDATED -eq 1 ]; then
            echo "   ✅ Copied $COPIED files, updated Fyers credentials"
        else
            echo "   ✅ Copied $COPIED files (no credentials found or update skipped)"
        fi
    else
        echo "   ✅ Copied $COPIED files"
    fi
done

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [ $ERRORS -eq 0 ]; then
    echo "✅ All instances synchronized successfully!"
else
    echo "⚠️  Sync completed with warnings!"
    echo "   ${#MISSING_FILES[@]} source file(s) were missing and could not be copied."
    echo ""
    echo "   To fix this, ensure these files exist in apps/backend/data/:"
    for FILE in "${MISSING_FILES[@]}"; do
        echo "     - $FILE"
    done
fi
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
