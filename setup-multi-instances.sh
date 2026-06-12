#!/bin/bash

################################################################################
# DAKS TOP-K STOCKS - Multi-Instance Setup Script
# Initializes and configures multiple independent instances
# Version: 1.0
# Date: December 22, 2025
################################################################################

set -e

# ═══════════════════════════════════════════════════════════════════════════
# CONFIGURATION
# ═══════════════════════════════════════════════════════════════════════════

PROJECT_DIR=$(pwd)
MULTI_INSTANCES_DIR="$PROJECT_DIR/multi-instances"
NUM_INSTANCES=${1:-3}
SERVER_IP=${2:-1000.93.172.21}
POSTGRES_PASSWORD=${POSTGRES_PASSWORD:-daks_secure_password_2025}

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# ═══════════════════════════════════════════════════════════════════════════
# UTILITY FUNCTIONS
# ═══════════════════════════════════════════════════════════════════════════

print_header() {
    echo ""
    echo -e "${BLUE}╔════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║${NC} $1"
    echo -e "${BLUE}╚════════════════════════════════════════════════════════════════╝${NC}"
    echo ""
}

print_success() {
    echo -e "${GREEN}✅${NC} $1"
}

print_error() {
    echo -e "${RED}❌${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠️${NC} $1"
}

print_info() {
    echo -e "${CYAN}ℹ️${NC} $1"
}

# ═══════════════════════════════════════════════════════════════════════════
# MAIN SETUP
# ═══════════════════════════════════════════════════════════════════════════

print_header "DAKS Multi-Instance Setup ($NUM_INSTANCES Instances)"

# Step 1: Create directory structure
print_info "Step 1: Creating directory structure..."
if [ ! -d "$MULTI_INSTANCES_DIR" ]; then
    mkdir -p "$MULTI_INSTANCES_DIR"
    print_success "Created $MULTI_INSTANCES_DIR"
fi

mkdir -p "$MULTI_INSTANCES_DIR/monitoring"
mkdir -p "$MULTI_INSTANCES_DIR/logs"
mkdir -p "$MULTI_INSTANCES_DIR/scripts"

for i in $(seq 1 $NUM_INSTANCES); do
    INSTANCE_DIR="$MULTI_INSTANCES_DIR/instance$i"
    mkdir -p "$INSTANCE_DIR/data"
    mkdir -p "$INSTANCE_DIR/logs"
    mkdir -p "$INSTANCE_DIR/config"
    mkdir -p "$INSTANCE_DIR/backups"
    print_success "Created instance$i structure"
done

# Step 2: Create .env template
print_info "Step 2: Creating environment template..."
cat > "$MULTI_INSTANCES_DIR/.env.template" << 'EOF'
# ═══════════════════════════════════════════════════════════════════════════
# DAKS TOP-K STOCKS - Instance Configuration Template
# Copy this and customize for each instance
# ═══════════════════════════════════════════════════════════════════════════

# Instance Identification
INSTANCE_ID=instance1
INSTANCE_NAME="DAKS Instance 1"
INSTANCE_REGION=local
SERVER_IP=1000.93.172.21

# ═══════════════════════════════════════════════════════════════════════════
# PORT CONFIGURATION
# ═══════════════════════════════════════════════════════════════════════════

FRONTEND_PORT=3000
BACKEND_PORT=5002
FYERS_5001_PORT=8001
FYERS_5010_PORT=8010
POSTGRES_PORT=5432
REDIS_PORT=6379

# ═══════════════════════════════════════════════════════════════════════════
# DATABASE CONFIGURATION
# ═══════════════════════════════════════════════════════════════════════════

POSTGRES_USER=postgres
POSTGRES_PASSWORD=daks_secure_password_2025
POSTGRES_DB=daks_stocks_instance1
DATABASE_URL=postgresql://postgres:daks_secure_password_2025@db:5432/daks_stocks_instance1

# ═══════════════════════════════════════════════════════════════════════════
# REDIS CONFIGURATION
# ═══════════════════════════════════════════════════════════════════════════

REDIS_URL=redis://redis:6379
REDIS_PASSWORD=

# ═══════════════════════════════════════════════════════════════════════════
# FYERS API CONFIGURATION
# ═══════════════════════════════════════════════════════════════════════════

FYERS_CLIENT_ID=YOUR_FYERS_CLIENT_ID_HERE
FYERS_SECRET_ID=YOUR_FYERS_SECRET_ID_HERE
FYERS_REDIRECT_URI=http://localhost:3000/auth/callback
FYERS_ACCESS_TOKEN=YOUR_FYERS_ACCESS_TOKEN_HERE

# ═══════════════════════════════════════════════════════════════════════════
# ENVIRONMENT CONFIGURATION
# ═══════════════════════════════════════════════════════════════════════════

NODE_ENV=production
PYTHONUNBUFFERED=1
PYTHONDONTWRITEBYTECODE=1
TZ=Asia/Kolkata

# ═══════════════════════════════════════════════════════════════════════════
# SERVICE URLS (FOR INTERNAL COMMUNICATION)
# ═══════════════════════════════════════════════════════════════════════════

NEXT_PUBLIC_API_URL=http://localhost:5002
BACKEND_URL=http://backend:5002
FYERS_SERVICE_5001_URL=http://localhost:8001
FYERS_SERVICE_5010_URL=http://localhost:8010

# ═══════════════════════════════════════════════════════════════════════════
# LOGGING CONFIGURATION
# ═══════════════════════════════════════════════════════════════════════════

LOG_LEVEL=debug
LOG_DIR=/app/logs

# ═══════════════════════════════════════════════════════════════════════════
# PERFORMANCE CONFIGURATION
# ═══════════════════════════════════════════════════════════════════════════

MAX_CONNECTIONS=100
REDIS_MAX_MEMORY=512mb
WORKER_THREADS=4

EOF

print_success "Created .env template"

# Step 3: Create .env for each instance
print_info "Step 3: Creating environment files for each instance..."
for i in $(seq 1 $NUM_INSTANCES); do
    INSTANCE_DIR="$MULTI_INSTANCES_DIR/instance$i"
    ENV_FILE="$INSTANCE_DIR/.env"
    
    cp "$MULTI_INSTANCES_DIR/.env.template" "$ENV_FILE"
    
    # Calculate ports (port offsets)
    FRONTEND_PORT=$((3000 + (i-1)*1000))
    BACKEND_PORT=$((5002 + (i-1)*100))
    FYERS_5001_PORT=$((8001 + (i-1)))
    FYERS_5010_PORT=$((8010 + (i-1)))
    POSTGRES_PORT=$((5432 + (i-1)))
    REDIS_PORT=$((6379 + (i-1)))
    
    DB_NAME="daks_stocks_instance$i"
    DB_URL="postgresql://postgres:$POSTGRES_PASSWORD@db:5432/$DB_NAME"
    API_URL="http://localhost:$BACKEND_PORT"
    
    # Update .env file (using sed for compatibility)
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        sed -i '' "s/INSTANCE_ID=.*/INSTANCE_ID=instance$i/" "$ENV_FILE"
        sed -i '' "s/INSTANCE_NAME=.*/INSTANCE_NAME=\"DAKS Instance $i\"/" "$ENV_FILE"
        sed -i '' "s/SERVER_IP=.*/SERVER_IP=$SERVER_IP/" "$ENV_FILE"
        sed -i '' "s/FRONTEND_PORT=.*/FRONTEND_PORT=$FRONTEND_PORT/" "$ENV_FILE"
        sed -i '' "s/BACKEND_PORT=.*/BACKEND_PORT=$BACKEND_PORT/" "$ENV_FILE"
        sed -i '' "s/FYERS_5001_PORT=.*/FYERS_5001_PORT=$FYERS_5001_PORT/" "$ENV_FILE"
        sed -i '' "s/FYERS_5010_PORT=.*/FYERS_5010_PORT=$FYERS_5010_PORT/" "$ENV_FILE"
        sed -i '' "s/POSTGRES_PORT=.*/POSTGRES_PORT=$POSTGRES_PORT/" "$ENV_FILE"
        sed -i '' "s/REDIS_PORT=.*/REDIS_PORT=$REDIS_PORT/" "$ENV_FILE"
        sed -i '' "s/POSTGRES_DB=.*/POSTGRES_DB=$DB_NAME/" "$ENV_FILE"
        sed -i '' "s|DATABASE_URL=.*|DATABASE_URL=$DB_URL|" "$ENV_FILE"
        sed -i '' "s|NEXT_PUBLIC_API_URL=.*|NEXT_PUBLIC_API_URL=http:\/\/$SERVER_IP:$BACKEND_PORT|" "$ENV_FILE"
    else
        # Linux
        sed -i "s/INSTANCE_ID=.*/INSTANCE_ID=instance$i/" "$ENV_FILE"
        sed -i "s/INSTANCE_NAME=.*/INSTANCE_NAME=\"DAKS Instance $i\"/" "$ENV_FILE"
        sed -i "s/SERVER_IP=.*/SERVER_IP=$SERVER_IP/" "$ENV_FILE"
        sed -i "s/FRONTEND_PORT=.*/FRONTEND_PORT=$FRONTEND_PORT/" "$ENV_FILE"
        sed -i "s/BACKEND_PORT=.*/BACKEND_PORT=$BACKEND_PORT/" "$ENV_FILE"
        sed -i "s/FYERS_5001_PORT=.*/FYERS_5001_PORT=$FYERS_5001_PORT/" "$ENV_FILE"
        sed -i "s/FYERS_5010_PORT=.*/FYERS_5010_PORT=$FYERS_5010_PORT/" "$ENV_FILE"
        sed -i "s/POSTGRES_PORT=.*/POSTGRES_PORT=$POSTGRES_PORT/" "$ENV_FILE"
        sed -i "s/REDIS_PORT=.*/REDIS_PORT=$REDIS_PORT/" "$ENV_FILE"
        sed -i "s/POSTGRES_DB=.*/POSTGRES_DB=$DB_NAME/" "$ENV_FILE"
        sed -i "s|DATABASE_URL=.*|DATABASE_URL=$DB_URL|" "$ENV_FILE"
        sed -i "s|NEXT_PUBLIC_API_URL=.*|NEXT_PUBLIC_API_URL=http:\/\/$SERVER_IP:$BACKEND_PORT|" "$ENV_FILE"
    fi
    
    print_success "Created .env for instance$i (Ports: Frontend=$FRONTEND_PORT, Backend=$BACKEND_PORT, DB=$POSTGRES_PORT, Redis=$REDIS_PORT)"
done

# Step 4: Copy docker-compose files to instances
print_info "Step 4: Setting up docker-compose files..."
if [ -f "$PROJECT_DIR/docker-compose.standalone.yml" ]; then
    for i in $(seq 1 $NUM_INSTANCES); do
        INSTANCE_DIR="$MULTI_INSTANCES_DIR/instance$i"
        cp "$PROJECT_DIR/docker-compose.standalone.yml" "$INSTANCE_DIR/docker-compose.standalone.yml"
        print_success "Setup instance$i docker-compose"
    done
else
    print_warning "docker-compose.standalone.yml not found in project root"
fi

# Step 5: Copy management script
print_info "Step 5: Setting up management scripts..."
if [ -f "$PROJECT_DIR/multi-instance-manager.sh" ]; then
    cp "$PROJECT_DIR/multi-instance-manager.sh" "$MULTI_INSTANCES_DIR/manager.sh"
    chmod +x "$MULTI_INSTANCES_DIR/manager.sh"
    print_success "Copied and made manager.sh executable"
fi

# Step 6: Create convenience scripts
cat > "$MULTI_INSTANCES_DIR/start-all.sh" << 'EOF'
#!/bin/bash
cd "$(dirname "$0")"
./manager.sh start-all
EOF
chmod +x "$MULTI_INSTANCES_DIR/start-all.sh"
print_success "Created start-all.sh"

cat > "$MULTI_INSTANCES_DIR/stop-all.sh" << 'EOF'
#!/bin/bash
cd "$(dirname "$0")"
./manager.sh stop-all
EOF
chmod +x "$MULTI_INSTANCES_DIR/stop-all.sh"
print_success "Created stop-all.sh"

cat > "$MULTI_INSTANCES_DIR/health-check.sh" << 'EOF'
#!/bin/bash
cd "$(dirname "$0")"
./manager.sh health-check
EOF
chmod +x "$MULTI_INSTANCES_DIR/health-check.sh"
print_success "Created health-check.sh"

# Step 7: Create README
cat > "$MULTI_INSTANCES_DIR/README.md" << 'EOF'
# DAKS TOP-K STOCKS - Multi-Instance Deployment

This directory contains configurations for running multiple independent instances of the DAKS system.

## Quick Start

### Start All Instances
```bash
./start-all.sh
```

### Stop All Instances
```bash
./stop-all.sh
```

### Check Health
```bash
./health-check.sh
```

### Manage Instances
```bash
./manager.sh help
```

## Instance Details

Each instance has:
- Independent frontend (Next.js)
- Independent backend API (NestJS)
- Independent database (PostgreSQL)
- Independent cache (Redis)
- Independent Fyers services (Python)

### Port Mapping

Instance 1: Frontend 3000, Backend 5002, DB 5432, Redis 6379
Instance 2: Frontend 4000, Backend 5102, DB 5433, Redis 6380
Instance 3: Frontend 5000, Backend 5202, DB 5434, Redis 6381

## Configuration

Each instance has a `.env` file with:
- Instance ID and name
- Port assignments
- Database credentials
- Fyers API credentials
- Service URLs

## Management Commands

Start specific instance:
```bash
./manager.sh start 1
```

View logs:
```bash
./manager.sh logs 1
```

Health check:
```bash
./manager.sh health-check
```

## Database Operations

Backup database:
```bash
./manager.sh db-backup 1
```

Restore database:
```bash
./manager.sh db-restore 1 backup_file.sql
```

## Monitoring

Resources:
```bash
./manager.sh resources
```

Report:
```bash
./manager.sh report
```

EOF

print_success "Created README.md"

# Final summary
print_header "Setup Complete!"

echo -e "${CYAN}Multi-Instance Configuration Summary:${NC}"
echo ""
echo "Total Instances: $NUM_INSTANCES"
echo "Setup Directory: $MULTI_INSTANCES_DIR"
echo ""

echo -e "${CYAN}Instance Port Assignments:${NC}"
for i in $(seq 1 $NUM_INSTANCES); do
    FRONTEND_PORT=$((3000 + (i-1)*1000))
    BACKEND_PORT=$((5002 + (i-1)*100))
    DB_PORT=$((5432 + (i-1)))
    REDIS_PORT=$((6379 + (i-1)))
    
    echo ""
    echo "  Instance $i:"
    echo "    Frontend:  http://localhost:$FRONTEND_PORT"
    echo "    Backend:   http://localhost:$BACKEND_PORT"
    echo "    Database:  localhost:$DB_PORT"
    echo "    Redis:     localhost:$REDIS_PORT"
done

echo ""
echo -e "${CYAN}Next Steps:${NC}"
echo "  1. Update Fyers credentials in each .env file"
echo "  2. Run: cd $MULTI_INSTANCES_DIR && ./start-all.sh"
echo "  3. Check health: ./health-check.sh"
echo "  4. View logs: ./manager.sh logs 1"
echo ""
echo -e "${GREEN}Setup successful!${NC}"
echo ""
