#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════
# DAKS Instance 3 - Start Script
# This script starts all services for Instance 3 using its own .env file
# ═══════════════════════════════════════════════════════════════════════════

set -e

# Get the directory of this script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Set the instance-specific environment file
export DAKS_ENV_FILE="$SCRIPT_DIR/.env"
export DAKS_DATA_DIR="$SCRIPT_DIR/data"

echo "🚀 Starting DAKS Instance 3..."
echo "   Environment: $DAKS_ENV_FILE"
echo "   Data Dir: $DAKS_DATA_DIR"
echo ""

# Navigate to backend directory
cd "$PROJECT_ROOT/apps/backend"

# Start services
echo "📡 Starting Fyers Service 5001..."
python3 fyers_service_5001.py &
FYERS_5001_PID=$!

echo "📡 Starting Fyers Service 5010..."
python3 fyers_service_5010.py &
FYERS_5010_PID=$!

echo "🌐 Starting Backend..."
npm run start &
BACKEND_PID=$!

# Navigate to frontend directory
cd "$PROJECT_ROOT/apps/frontend"

echo "🎨 Starting Frontend..."
npm run dev &
FRONTEND_PID=$!

echo ""
echo "✅ Instance 3 started!"
echo "   Fyers 5001 PID: $FYERS_5001_PID"
echo "   Fyers 5010 PID: $FYERS_5010_PID"
echo "   Backend PID: $BACKEND_PID"
echo "   Frontend PID: $FRONTEND_PID"
echo ""
echo "   Press Ctrl+C to stop all services"

# Wait for any process to exit
wait
