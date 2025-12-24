# Multi-Instance Deployment Guide - APM TOP-K STOCKS

**Version:** 1.0  
**Date:** December 22, 2025  
**Architecture:** Decentralized Multi-Instance (No Inter-Service Dependencies)

---

## TABLE OF CONTENTS

1. [Overview](#overview)
2. [Architecture Design](#architecture-design)
3. [Instance Types](#instance-types)
4. [Setup Instructions](#setup-instructions)
5. [Running Multiple Instances](#running-multiple-instances)
6. [Configuration Files](#configuration-files)
7. [Scaling & Load Balancing](#scaling--load-balancing)
8. [Monitoring Multiple Instances](#monitoring-multiple-instances)
9. [Troubleshooting](#troubleshooting)

---

## OVERVIEW

This guide enables running **completely independent instances** of the APM TOP-K STOCKS system where:

✅ **Each instance is self-contained**  
✅ **No service-to-service dependencies**  
✅ **Each can be started/stopped independently**  
✅ **Isolated data and databases**  
✅ **Scalable to 50+ instances**  
✅ **Monitoring and health checks built-in**

### Multi-Instance Architecture

```
┌─────────────────────────────────────────────────────────────┐
│            MULTI-INSTANCE DEPLOYMENT INFRASTRUCTURE         │
└─────────────────────────────────────────────────────────────┘

   INSTANCE 1          INSTANCE 2          INSTANCE 3
┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐
│  Frontend:3000   │ │  Frontend:4000   │ │  Frontend:5000   │
│  Backend:5002    │ │  Backend:5202    │ │  Backend:5302    │
│  Fyers-5001:8001 │ │  Fyers-5001:8002 │ │  Fyers-5001:8003 │
│  Fyers-5010:8010 │ │  Fyers-5010:8011 │ │  Fyers-5010:8012 │
│  DB (local)      │ │  DB (local)      │ │  DB (local)      │
│  Redis (local)   │ │  Redis (local)   │ │  Redis (local)   │
└──────────────────┘ └──────────────────┘ └──────────────────┘
        │                    │                    │
        └────────────────────┴────────────────────┘
              (NO inter-instance communication)
              (Each instance works independently)
                         │
                    ┌────┴────┐
              ┌─────▼──┐  ┌──▼─────┐
              │ NGINX   │  │  LOGS  │
              │ PROXY   │  │ SERVER │
              └─────────┘  └────────┘
```

---

## ARCHITECTURE DESIGN

### Key Design Principles

1. **Independence**: Each instance has its own database, cache, and services
2. **Isolation**: No shared resources between instances
3. **Scalability**: Add/remove instances without affecting others
4. **Portability**: Each instance can run on different servers
5. **Monitoring**: Central monitoring dashboard for all instances
6. **Failover**: One instance failure doesn't affect others

### Service Structure per Instance

```
Instance Layout:
├── Frontend (Next.js) - Port: 3000 + offset
├── Backend API (NestJS) - Port: 5002 + offset
├── Fyers Service 5001 (Python) - Port: 8001 + offset
├── Fyers Service 5010 (Python) - Port: 8010 + offset
├── PostgreSQL Database (isolated)
├── Redis Cache (isolated)
└── Health Monitoring (internal)
```

---

## INSTANCE TYPES

### Type 1: Standalone Instance (Self-Contained)
- **Best For**: Single deployment, testing, development
- **Includes**: All services (Frontend + Backend + Services)
- **Complexity**: Low
- **File**: `docker-compose.standalone.yml`

### Type 2: Multi-Instance Cluster (Production)
- **Best For**: Production with multiple parallel instances
- **Includes**: N independent instances with shared monitoring
- **Complexity**: Medium
- **File**: `docker-compose.multi-instance.yml`

### Type 3: Distributed Instance (Separate Servers)
- **Best For**: Geo-distributed deployments
- **Includes**: Single instance per server with central coordination
- **Complexity**: High
- **File**: `docker-compose.distributed.yml`

### Type 4: Microservices Instance (Separated Services)
- **Best For**: Development/testing individual services
- **Includes**: Single service per container, no dependencies
- **Complexity**: Medium
- **File**: `docker-compose.microservices.yml`

---

## SETUP INSTRUCTIONS

### Step 1: Create Instance Configuration Directory Structure

```bash
# Create multi-instance directory
mkdir -p multi-instances/{instance1,instance2,instance3}
mkdir -p multi-instances/monitoring
mkdir -p multi-instances/scripts

# Copy for each instance
for i in {1..3}; do
  mkdir -p multi-instances/instance$i/{data,logs,config}
done
```

### Step 2: Generate Environment Files for Each Instance

```bash
# Create base template
cat > multi-instances/.env.template << 'EOF'
# Instance Configuration
INSTANCE_ID=instance1
INSTANCE_NAME="APM Instance 1"
INSTANCE_OFFSET=0

# Ports (will be calculated as base_port + offset)
FRONTEND_PORT=3000
BACKEND_PORT=5002
FYERS_5001_PORT=8001
FYERS_5010_PORT=8010
POSTGRES_PORT=5432
REDIS_PORT=6379

# Database
POSTGRES_USER=postgres
POSTGRES_PASSWORD=secure_password_here
POSTGRES_DB=apm_stocks_instance1
DATABASE_URL=postgresql://postgres:secure_password_here@db:5432/apm_stocks_instance1

# Redis
REDIS_URL=redis://redis:6379

# Fyers API
FYERS_CLIENT_ID=your_client_id_here
FYERS_SECRET_ID=your_secret_id_here
FYERS_REDIRECT_URI=http://localhost:3000/auth/callback
FYERS_ACCESS_TOKEN=your_access_token_here

# Environment
NODE_ENV=development
PYTHONUNBUFFERED=1

# Service URLs (internal)
NEXT_PUBLIC_API_URL=http://localhost:5002
BACKEND_URL=http://backend:5002
FYERS_SERVICE_5001_URL=http://localhost:8001
FYERS_SERVICE_5010_URL=http://localhost:8010
EOF

# Create .env for each instance
for i in {1..3}; do
  OFFSET=$((i-1))
  cp multi-instances/.env.template multi-instances/instance$i/.env
  sed -i "s/INSTANCE_ID=.*/INSTANCE_ID=instance$i/" multi-instances/instance$i/.env
  sed -i "s/INSTANCE_OFFSET=.*/INSTANCE_OFFSET=$OFFSET/" multi-instances/instance$i/.env
  sed -i "s/apm_stocks_instance.*/apm_stocks_instance$i/" multi-instances/instance$i/.env
  sed -i "s/FRONTEND_PORT=.*/FRONTEND_PORT=$((3000 + OFFSET*1000))/" multi-instances/instance$i/.env
  sed -i "s/BACKEND_PORT=.*/BACKEND_PORT=$((5002 + OFFSET*100))/" multi-instances/instance$i/.env
done
```

### Step 3: Create Docker Network (Shared)

```bash
# Create shared bridge network for monitoring only
docker network create apm-multi-network
```

### Step 4: Start Instances

```bash
# Start Instance 1
cd multi-instances/instance1
docker-compose -f docker-compose.standalone.yml up -d

# Start Instance 2 (in different terminal)
cd multi-instances/instance2
docker-compose -f docker-compose.standalone.yml up -d

# Start Instance 3 (in different terminal)
cd multi-instances/instance3
docker-compose -f docker-compose.standalone.yml up -d
```

---

## RUNNING MULTIPLE INSTANCES

### Script: automated-multi-instance.sh

```bash
#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

PROJECT_DIR="/Users/raghav/Documents/GitHub/APM-TOP-K-STOCKS"
MULTI_INSTANCES_DIR="$PROJECT_DIR/multi-instances"
NUM_INSTANCES=${1:-3}

# Function to print colored output
print_status() {
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️ $1${NC}"
}

# Function to start a single instance
start_instance() {
    local instance_num=$1
    local instance_name="instance$instance_num"
    local instance_dir="$MULTI_INSTANCES_DIR/$instance_name"
    
    print_status "Starting Instance $instance_num ($instance_name)..."
    
    if [ ! -d "$instance_dir" ]; then
        print_error "Instance directory not found: $instance_dir"
        return 1
    fi
    
    cd "$instance_dir"
    
    if docker-compose -f docker-compose.standalone.yml up -d; then
        print_success "Instance $instance_num started successfully"
        
        # Get ports from .env
        FRONTEND_PORT=$(grep "FRONTEND_PORT=" .env | cut -d'=' -f2)
        BACKEND_PORT=$(grep "BACKEND_PORT=" .env | cut -d'=' -f2)
        
        sleep 2
        print_status "Instance $instance_num URLs:"
        echo -e "  ${BLUE}Frontend:${NC} http://localhost:$FRONTEND_PORT"
        echo -e "  ${BLUE}Backend:${NC} http://localhost:$BACKEND_PORT"
        
        return 0
    else
        print_error "Failed to start Instance $instance_num"
        return 1
    fi
}

# Function to stop a single instance
stop_instance() {
    local instance_num=$1
    local instance_name="instance$instance_num"
    local instance_dir="$MULTI_INSTANCES_DIR/$instance_name"
    
    print_status "Stopping Instance $instance_num..."
    
    cd "$instance_dir"
    
    if docker-compose -f docker-compose.standalone.yml down; then
        print_success "Instance $instance_num stopped"
        return 0
    else
        print_error "Failed to stop Instance $instance_num"
        return 1
    fi
}

# Function to check instance status
check_instance_status() {
    local instance_num=$1
    local instance_name="instance$instance_num"
    local instance_dir="$MULTI_INSTANCES_DIR/$instance_name"
    
    cd "$instance_dir"
    
    print_status "Checking Instance $instance_num status..."
    docker-compose -f docker-compose.standalone.yml ps
}

# Function to view instance logs
view_instance_logs() {
    local instance_num=$1
    local instance_name="instance$instance_num"
    local instance_dir="$MULTI_INSTANCES_DIR/$instance_name"
    
    cd "$instance_dir"
    
    print_status "Displaying logs for Instance $instance_num (Press Ctrl+C to exit)..."
    docker-compose -f docker-compose.standalone.yml logs -f
}

# Main menu
if [ $# -eq 0 ]; then
    echo -e "${BLUE}APM TOP-K STOCKS - Multi-Instance Manager${NC}"
    echo "=========================================="
    echo ""
    echo "Usage: $0 <command> [instance_number]"
    echo ""
    echo "Commands:"
    echo "  start-all              - Start all instances"
    echo "  stop-all               - Stop all instances"
    echo "  restart-all            - Restart all instances"
    echo "  status                 - Show status of all instances"
    echo "  logs <instance_num>    - View logs for specific instance"
    echo "  start <instance_num>   - Start specific instance"
    echo "  stop <instance_num>    - Stop specific instance"
    echo "  restart <instance_num> - Restart specific instance"
    echo "  health-check           - Check health of all instances"
    echo ""
    echo "Example:"
    echo "  $0 start-all"
    echo "  $0 start 2"
    echo "  $0 logs 1"
    echo ""
    exit 0
fi

COMMAND=$1
INSTANCE_NUM=${2:-1}

case "$COMMAND" in
    start-all)
        print_status "Starting all $NUM_INSTANCES instances..."
        for ((i=1; i<=NUM_INSTANCES; i++)); do
            start_instance $i
            sleep 3
        done
        print_success "All instances started!"
        ;;
    stop-all)
        print_status "Stopping all $NUM_INSTANCES instances..."
        for ((i=1; i<=NUM_INSTANCES; i++)); do
            stop_instance $i
            sleep 1
        done
        print_success "All instances stopped!"
        ;;
    restart-all)
        print_status "Restarting all $NUM_INSTANCES instances..."
        for ((i=1; i<=NUM_INSTANCES; i++)); do
            stop_instance $i
            sleep 1
            start_instance $i
            sleep 3
        done
        print_success "All instances restarted!"
        ;;
    status)
        print_status "Status of all instances:"
        for ((i=1; i<=NUM_INSTANCES; i++)); do
            echo ""
            check_instance_status $i
        done
        ;;
    logs)
        view_instance_logs $INSTANCE_NUM
        ;;
    start)
        start_instance $INSTANCE_NUM
        ;;
    stop)
        stop_instance $INSTANCE_NUM
        ;;
    restart)
        print_status "Restarting Instance $INSTANCE_NUM..."
        stop_instance $INSTANCE_NUM
        sleep 2
        start_instance $INSTANCE_NUM
        ;;
    health-check)
        print_status "Performing health checks on all instances..."
        for ((i=1; i<=NUM_INSTANCES; i++)); do
            instance_dir="$MULTI_INSTANCES_DIR/instance$i"
            cd "$instance_dir"
            
            FRONTEND_PORT=$(grep "FRONTEND_PORT=" .env | cut -d'=' -f2)
            BACKEND_PORT=$(grep "BACKEND_PORT=" .env | cut -d'=' -f2)
            
            echo ""
            print_status "Instance $i Health Check:"
            
            if curl -s http://localhost:$FRONTEND_PORT > /dev/null; then
                print_success "Frontend (port $FRONTEND_PORT): OK"
            else
                print_error "Frontend (port $FRONTEND_PORT): FAILED"
            fi
            
            if curl -s http://localhost:$BACKEND_PORT/health > /dev/null 2>&1; then
                print_success "Backend (port $BACKEND_PORT): OK"
            else
                print_error "Backend (port $BACKEND_PORT): FAILED"
            fi
        done
        ;;
    *)
        print_error "Unknown command: $COMMAND"
        echo "Use: $0 (without arguments) to see help"
        exit 1
        ;;
esac
```

### Usage Examples

```bash
# Save the script
chmod +x multi-instance-manager.sh

# Start all instances
./multi-instance-manager.sh start-all

# Start specific instance
./multi-instance-manager.sh start 2

# Check all health
./multi-instance-manager.sh health-check

# View logs for instance 1
./multi-instance-manager.sh logs 1

# Stop all
./multi-instance-manager.sh stop-all
```

---

## CONFIGURATION FILES

### File 1: docker-compose.standalone.yml

Save as: `multi-instances/instance1/docker-compose.standalone.yml`

```yaml
version: '3.8'

services:
  # Frontend
  frontend:
    build:
      context: ../../
      dockerfile: Dockerfile.frontend
    container_name: ${INSTANCE_ID}-frontend
    restart: unless-stopped
    ports:
      - "${FRONTEND_PORT}:3000"
    environment:
      - NEXT_PUBLIC_API_URL=http://localhost:${BACKEND_PORT}
      - BACKEND_URL=http://backend:5002
    env_file:
      - .env
    volumes:
      - ../../apps/frontend:/app
      - /app/node_modules
      - /app/.next
    networks:
      - ${INSTANCE_ID}-network
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

  # Backend API
  backend:
    build:
      context: ../../
      dockerfile: Dockerfile.backend
    container_name: ${INSTANCE_ID}-backend
    restart: unless-stopped
    ports:
      - "${BACKEND_PORT}:5002"
    environment:
      - PORT=5002
      - NODE_ENV=development
      - DATABASE_URL=postgresql://postgres:${POSTGRES_PASSWORD}@db:5432/${POSTGRES_DB}
      - REDIS_URL=redis://redis:6379
    env_file:
      - .env
    volumes:
      - ../../apps/backend:/app
      - ./data:/app/data
    depends_on:
      db:
        condition: service_healthy
      redis:
        condition: service_healthy
    networks:
      - ${INSTANCE_ID}-network
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:5002/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 30s

  # PostgreSQL
  db:
    image: postgres:15-alpine
    container_name: ${INSTANCE_ID}-db
    restart: unless-stopped
    ports:
      - "${POSTGRES_PORT}:5432"
    environment:
      - POSTGRES_USER=${POSTGRES_USER}
      - POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
      - POSTGRES_DB=${POSTGRES_DB}
    volumes:
      - ${INSTANCE_ID}-postgres-data:/var/lib/postgresql/data
      - ../../init-db.sql:/docker-entrypoint-initdb.d/init.sql
    networks:
      - ${INSTANCE_ID}-network
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER}"]
      interval: 10s
      timeout: 5s
      retries: 5

  # Redis
  redis:
    image: redis:7-alpine
    container_name: ${INSTANCE_ID}-redis
    restart: unless-stopped
    ports:
      - "${REDIS_PORT}:6379"
    volumes:
      - ${INSTANCE_ID}-redis-data:/data
    networks:
      - ${INSTANCE_ID}-network
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  # Fyers Service 5001
  fyers-5001:
    build:
      context: ../../
      dockerfile: Dockerfile.python-5001
    container_name: ${INSTANCE_ID}-fyers-5001
    restart: unless-stopped
    ports:
      - "${FYERS_5001_PORT}:5001"
    environment:
      - PYTHONUNBUFFERED=1
      - FYERS_CLIENT_ID=${FYERS_CLIENT_ID}
      - FYERS_SECRET_ID=${FYERS_SECRET_ID}
    env_file:
      - .env
    volumes:
      - ../../apps/backend:/app
      - ./data:/app/data
    depends_on:
      db:
        condition: service_healthy
    networks:
      - ${INSTANCE_ID}-network

  # Fyers Service 5010
  fyers-5010:
    build:
      context: ../../
      dockerfile: Dockerfile.python-5010
    container_name: ${INSTANCE_ID}-fyers-5010
    restart: unless-stopped
    ports:
      - "${FYERS_5010_PORT}:5010"
    environment:
      - PYTHONUNBUFFERED=1
      - FYERS_CLIENT_ID=${FYERS_CLIENT_ID}
      - FYERS_SECRET_ID=${FYERS_SECRET_ID}
    env_file:
      - .env
    volumes:
      - ../../apps/backend:/app
      - ./data:/app/data
    depends_on:
      db:
        condition: service_healthy
    networks:
      - ${INSTANCE_ID}-network

volumes:
  ${INSTANCE_ID}-postgres-data:
  ${INSTANCE_ID}-redis-data:

networks:
  ${INSTANCE_ID}-network:
    driver: bridge
```

### File 2: docker-compose.multi-instance.yml

Save as: `docker-compose.multi-instance.yml` (Root Directory)

```yaml
version: '3.8'

# This file orchestrates multiple independent instances
# Each instance is completely self-contained

services:
  # ═══════════════════════════════════════════════════════════════════════════
  # INSTANCE 1
  # ═══════════════════════════════════════════════════════════════════════════
  
  frontend-1:
    build:
      context: .
      dockerfile: Dockerfile.frontend
    container_name: apm-frontend-1
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      - NEXT_PUBLIC_API_URL=http://localhost:5002
      - BACKEND_URL=http://backend-1:5002
    env_file:
      - multi-instances/instance1/.env
    volumes:
      - ./apps/frontend:/app
      - frontend-1-node:/app/node_modules
      - frontend-1-next:/app/.next
    networks:
      - instance1-network
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000"]
      interval: 30s
      timeout: 10s
      retries: 3

  backend-1:
    build:
      context: .
      dockerfile: Dockerfile.backend
    container_name: apm-backend-1
    restart: unless-stopped
    ports:
      - "5002:5002"
    environment:
      - PORT=5002
      - NODE_ENV=development
    env_file:
      - multi-instances/instance1/.env
    volumes:
      - ./apps/backend:/app
      - instance1-data:/app/data
    depends_on:
      db-1:
        condition: service_healthy
      redis-1:
        condition: service_healthy
    networks:
      - instance1-network
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:5002/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  db-1:
    image: postgres:15-alpine
    container_name: apm-db-1
    restart: unless-stopped
    ports:
      - "5432:5432"
    environment:
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
      - POSTGRES_DB=apm_stocks_1
    volumes:
      - instance1-postgres:/var/lib/postgresql/data
      - ./init-db.sql:/docker-entrypoint-initdb.d/init.sql
    networks:
      - instance1-network
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis-1:
    image: redis:7-alpine
    container_name: apm-redis-1
    restart: unless-stopped
    ports:
      - "6379:6379"
    volumes:
      - instance1-redis:/data
    networks:
      - instance1-network
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  fyers-5001-1:
    build:
      context: .
      dockerfile: Dockerfile.python-5001
    container_name: apm-fyers-5001-1
    restart: unless-stopped
    ports:
      - "8001:5001"
    environment:
      - PYTHONUNBUFFERED=1
    env_file:
      - multi-instances/instance1/.env
    volumes:
      - ./apps/backend:/app
      - instance1-data:/app/data
    depends_on:
      db-1:
        condition: service_healthy
    networks:
      - instance1-network

  fyers-5010-1:
    build:
      context: .
      dockerfile: Dockerfile.python-5010
    container_name: apm-fyers-5010-1
    restart: unless-stopped
    ports:
      - "8010:5010"
    environment:
      - PYTHONUNBUFFERED=1
    env_file:
      - multi-instances/instance1/.env
    volumes:
      - ./apps/backend:/app
      - instance1-data:/app/data
    depends_on:
      db-1:
        condition: service_healthy
    networks:
      - instance1-network

  # ═══════════════════════════════════════════════════════════════════════════
  # INSTANCE 2
  # ═══════════════════════════════════════════════════════════════════════════

  frontend-2:
    build:
      context: .
      dockerfile: Dockerfile.frontend
    container_name: apm-frontend-2
    restart: unless-stopped
    ports:
      - "4000:3000"
    environment:
      - NEXT_PUBLIC_API_URL=http://localhost:5102
      - BACKEND_URL=http://backend-2:5002
    env_file:
      - multi-instances/instance2/.env
    volumes:
      - ./apps/frontend:/app
      - frontend-2-node:/app/node_modules
      - frontend-2-next:/app/.next
    networks:
      - instance2-network
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000"]
      interval: 30s
      timeout: 10s
      retries: 3

  backend-2:
    build:
      context: .
      dockerfile: Dockerfile.backend
    container_name: apm-backend-2
    restart: unless-stopped
    ports:
      - "5102:5002"
    environment:
      - PORT=5002
      - NODE_ENV=development
    env_file:
      - multi-instances/instance2/.env
    volumes:
      - ./apps/backend:/app
      - instance2-data:/app/data
    depends_on:
      db-2:
        condition: service_healthy
      redis-2:
        condition: service_healthy
    networks:
      - instance2-network
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:5002/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  db-2:
    image: postgres:15-alpine
    container_name: apm-db-2
    restart: unless-stopped
    ports:
      - "5433:5432"
    environment:
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
      - POSTGRES_DB=apm_stocks_2
    volumes:
      - instance2-postgres:/var/lib/postgresql/data
      - ./init-db.sql:/docker-entrypoint-initdb.d/init.sql
    networks:
      - instance2-network
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis-2:
    image: redis:7-alpine
    container_name: apm-redis-2
    restart: unless-stopped
    ports:
      - "6380:6379"
    volumes:
      - instance2-redis:/data
    networks:
      - instance2-network
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  fyers-5001-2:
    build:
      context: .
      dockerfile: Dockerfile.python-5001
    container_name: apm-fyers-5001-2
    restart: unless-stopped
    ports:
      - "8002:5001"
    environment:
      - PYTHONUNBUFFERED=1
    env_file:
      - multi-instances/instance2/.env
    volumes:
      - ./apps/backend:/app
      - instance2-data:/app/data
    depends_on:
      db-2:
        condition: service_healthy
    networks:
      - instance2-network

  fyers-5010-2:
    build:
      context: .
      dockerfile: Dockerfile.python-5010
    container_name: apm-fyers-5010-2
    restart: unless-stopped
    ports:
      - "8011:5010"
    environment:
      - PYTHONUNBUFFERED=1
    env_file:
      - multi-instances/instance2/.env
    volumes:
      - ./apps/backend:/app
      - instance2-data:/app/data
    depends_on:
      db-2:
        condition: service_healthy
    networks:
      - instance2-network

  # ═══════════════════════════════════════════════════════════════════════════
  # INSTANCE 3
  # ═══════════════════════════════════════════════════════════════════════════

  frontend-3:
    build:
      context: .
      dockerfile: Dockerfile.frontend
    container_name: apm-frontend-3
    restart: unless-stopped
    ports:
      - "5000:3000"
    environment:
      - NEXT_PUBLIC_API_URL=http://localhost:5202
      - BACKEND_URL=http://backend-3:5002
    env_file:
      - multi-instances/instance3/.env
    volumes:
      - ./apps/frontend:/app
      - frontend-3-node:/app/node_modules
      - frontend-3-next:/app/.next
    networks:
      - instance3-network
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000"]
      interval: 30s
      timeout: 10s
      retries: 3

  backend-3:
    build:
      context: .
      dockerfile: Dockerfile.backend
    container_name: apm-backend-3
    restart: unless-stopped
    ports:
      - "5202:5002"
    environment:
      - PORT=5002
      - NODE_ENV=development
    env_file:
      - multi-instances/instance3/.env
    volumes:
      - ./apps/backend:/app
      - instance3-data:/app/data
    depends_on:
      db-3:
        condition: service_healthy
      redis-3:
        condition: service_healthy
    networks:
      - instance3-network
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:5002/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  db-3:
    image: postgres:15-alpine
    container_name: apm-db-3
    restart: unless-stopped
    ports:
      - "5434:5432"
    environment:
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
      - POSTGRES_DB=apm_stocks_3
    volumes:
      - instance3-postgres:/var/lib/postgresql/data
      - ./init-db.sql:/docker-entrypoint-initdb.d/init.sql
    networks:
      - instance3-network
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis-3:
    image: redis:7-alpine
    container_name: apm-redis-3
    restart: unless-stopped
    ports:
      - "6381:6379"
    volumes:
      - instance3-redis:/data
    networks:
      - instance3-network
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  fyers-5001-3:
    build:
      context: .
      dockerfile: Dockerfile.python-5001
    container_name: apm-fyers-5001-3
    restart: unless-stopped
    ports:
      - "8003:5001"
    environment:
      - PYTHONUNBUFFERED=1
    env_file:
      - multi-instances/instance3/.env
    volumes:
      - ./apps/backend:/app
      - instance3-data:/app/data
    depends_on:
      db-3:
        condition: service_healthy
    networks:
      - instance3-network

  fyers-5010-3:
    build:
      context: .
      dockerfile: Dockerfile.python-5010
    container_name: apm-fyers-5010-3
    restart: unless-stopped
    ports:
      - "8012:5010"
    environment:
      - PYTHONUNBUFFERED=1
    env_file:
      - multi-instances/instance3/.env
    volumes:
      - ./apps/backend:/app
      - instance3-data:/app/data
    depends_on:
      db-3:
        condition: service_healthy
    networks:
      - instance3-network

volumes:
  frontend-1-node:
  frontend-1-next:
  frontend-2-node:
  frontend-2-next:
  frontend-3-node:
  frontend-3-next:
  instance1-data:
  instance1-postgres:
  instance1-redis:
  instance2-data:
  instance2-postgres:
  instance2-redis:
  instance3-data:
  instance3-postgres:
  instance3-redis:

networks:
  instance1-network:
    driver: bridge
  instance2-network:
    driver: bridge
  instance3-network:
    driver: bridge
```

### File 3: setup-multi-instances.sh

Save as: `setup-multi-instances.sh` (Root Directory)

```bash
#!/bin/bash

set -e

PROJECT_DIR=$(pwd)
MULTI_INSTANCES_DIR="$PROJECT_DIR/multi-instances"
NUM_INSTANCES=${1:-3}

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}================================${NC}"
echo -e "${BLUE}APM Multi-Instance Setup${NC}"
echo -e "${BLUE}================================${NC}"
echo ""

# Check if multi-instances directory exists
if [ ! -d "$MULTI_INSTANCES_DIR" ]; then
    echo "Creating multi-instances directory..."
    mkdir -p "$MULTI_INSTANCES_DIR"
fi

# Create instance directories
echo "Creating instance directories..."
for i in $(seq 1 $NUM_INSTANCES); do
    INSTANCE_DIR="$MULTI_INSTANCES_DIR/instance$i"
    mkdir -p "$INSTANCE_DIR/data"
    mkdir -p "$INSTANCE_DIR/logs"
    mkdir -p "$INSTANCE_DIR/config"
    echo -e "${GREEN}✓${NC} Created instance$i structure"
done

# Create .env template
echo ""
echo "Creating environment template..."
cat > "$MULTI_INSTANCES_DIR/.env.template" << 'EOF'
# Instance Configuration
INSTANCE_ID=instance1
INSTANCE_NAME="APM Instance 1"

# Ports
FRONTEND_PORT=3000
BACKEND_PORT=5002
FYERS_5001_PORT=8001
FYERS_5010_PORT=8010
POSTGRES_PORT=5432
REDIS_PORT=6379

# Database
POSTGRES_USER=postgres
POSTGRES_PASSWORD=apm_secure_password_2025
POSTGRES_DB=apm_stocks_instance1
DATABASE_URL=postgresql://postgres:apm_secure_password_2025@db:5432/apm_stocks_instance1

# Redis
REDIS_URL=redis://redis:6379

# Fyers API
FYERS_CLIENT_ID=your_client_id_here
FYERS_SECRET_ID=your_secret_id_here
FYERS_REDIRECT_URI=http://localhost:3000/auth/callback
FYERS_ACCESS_TOKEN=your_access_token_here

# Environment
NODE_ENV=development
PYTHONUNBUFFERED=1

# Service URLs
NEXT_PUBLIC_API_URL=http://localhost:5002
BACKEND_URL=http://backend:5002
FYERS_SERVICE_5001_URL=http://localhost:8001
FYERS_SERVICE_5010_URL=http://localhost:8010
EOF

# Create .env for each instance
echo "Creating environment files for each instance..."
for i in $(seq 1 $NUM_INSTANCES); do
    INSTANCE_DIR="$MULTI_INSTANCES_DIR/instance$i"
    ENV_FILE="$INSTANCE_DIR/.env"
    
    cp "$MULTI_INSTANCES_DIR/.env.template" "$ENV_FILE"
    
    # Calculate ports
    FRONTEND_PORT=$((3000 + (i-1)*1000))
    BACKEND_PORT=$((5002 + (i-1)*100))
    FYERS_5001_PORT=$((8001 + (i-1)))
    FYERS_5010_PORT=$((8010 + (i-1)))
    POSTGRES_PORT=$((5432 + (i-1)))
    REDIS_PORT=$((6379 + (i-1)))
    
    DB_NAME="apm_stocks_instance$i"
    DB_URL="postgresql://postgres:apm_secure_password_2025@db:5432/$DB_NAME"
    API_URL="http://localhost:$BACKEND_PORT"
    
    # Update .env file (macOS compatible)
    sed -i '' "s/INSTANCE_ID=.*/INSTANCE_ID=instance$i/" "$ENV_FILE"
    sed -i '' "s/INSTANCE_NAME=.*/INSTANCE_NAME=\"APM Instance $i\"/" "$ENV_FILE"
    sed -i '' "s/FRONTEND_PORT=.*/FRONTEND_PORT=$FRONTEND_PORT/" "$ENV_FILE"
    sed -i '' "s/BACKEND_PORT=.*/BACKEND_PORT=$BACKEND_PORT/" "$ENV_FILE"
    sed -i '' "s/FYERS_5001_PORT=.*/FYERS_5001_PORT=$FYERS_5001_PORT/" "$ENV_FILE"
    sed -i '' "s/FYERS_5010_PORT=.*/FYERS_5010_PORT=$FYERS_5010_PORT/" "$ENV_FILE"
    sed -i '' "s/POSTGRES_PORT=.*/POSTGRES_PORT=$POSTGRES_PORT/" "$ENV_FILE"
    sed -i '' "s/REDIS_PORT=.*/REDIS_PORT=$REDIS_PORT/" "$ENV_FILE"
    sed -i '' "s/apm_stocks_instance.*/apm_stocks_instance$i/" "$ENV_FILE"
    sed -i '' "s|postgresql://.*@db|postgresql://postgres:apm_secure_password_2025@db|" "$ENV_FILE"
    sed -i '' "s|NEXT_PUBLIC_API_URL=.*|NEXT_PUBLIC_API_URL=$API_URL|" "$ENV_FILE"
    
    echo -e "${GREEN}✓${NC} Created .env for instance$i (Frontend: $FRONTEND_PORT, Backend: $BACKEND_PORT)"
done

# Copy docker-compose file to each instance
echo ""
echo "Setting up docker-compose files..."
for i in $(seq 1 $NUM_INSTANCES); do
    INSTANCE_DIR="$MULTI_INSTANCES_DIR/instance$i"
    cp "$PROJECT_DIR/docker-compose.standalone.yml" "$INSTANCE_DIR/docker-compose.standalone.yml" 2>/dev/null || true
    echo -e "${GREEN}✓${NC} Setup instance$i docker-compose"
done

# Copy scripts
echo ""
echo "Copying management scripts..."
cp "$PROJECT_DIR/multi-instance-manager.sh" "$MULTI_INSTANCES_DIR/manager.sh" 2>/dev/null || true
chmod +x "$MULTI_INSTANCES_DIR/manager.sh" 2>/dev/null || true

echo ""
echo -e "${GREEN}================================${NC}"
echo -e "${GREEN}Setup Complete!${NC}"
echo -e "${GREEN}================================${NC}"
echo ""
echo "Next steps:"
echo "1. Update Fyers credentials in multi-instances/instance*/env"
echo "2. Run: cd multi-instances/instance1 && docker-compose -f docker-compose.standalone.yml up -d"
echo "3. Or run all: docker-compose -f docker-compose.multi-instance.yml up -d"
echo ""
echo "Instance Ports:"
for i in $(seq 1 $NUM_INSTANCES); do
    FRONTEND_PORT=$((3000 + (i-1)*1000))
    BACKEND_PORT=$((5002 + (i-1)*100))
    echo "  Instance $i: Frontend http://localhost:$FRONTEND_PORT | Backend http://localhost:$BACKEND_PORT"
done
echo ""
```

---

## SCALING & LOAD BALANCING

### NGINX Load Balancer Configuration

Save as: `nginx/nginx.conf`

```nginx
upstream frontend_instances {
    least_conn;
    server localhost:3000;
    server localhost:4000;
    server localhost:5000;
}

upstream backend_instances {
    least_conn;
    server localhost:5002;
    server localhost:5102;
    server localhost:5202;
}

server {
    listen 80;
    server_name apm.local;

    client_max_body_size 100M;

    # Frontend Load Balancing
    location / {
        proxy_pass http://frontend_instances;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Backend API Load Balancing
    location /api/ {
        proxy_pass http://backend_instances/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Health check endpoint
    location /health {
        access_log off;
        return 200 "healthy\n";
        add_header Content-Type text/plain;
    }
}
```

---

## MONITORING MULTIPLE INSTANCES

### Prometheus Configuration

Save as: `monitoring/prometheus.yml`

```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: 'apm-instance-1'
    static_configs:
      - targets: ['localhost:5002']
        labels:
          instance: 'instance1'

  - job_name: 'apm-instance-2'
    static_configs:
      - targets: ['localhost:5102']
        labels:
          instance: 'instance2'

  - job_name: 'apm-instance-3'
    static_configs:
      - targets: ['localhost:5202']
        labels:
          instance: 'instance3'

  - job_name: 'postgres-1'
    static_configs:
      - targets: ['localhost:5432']
        labels:
          instance: 'db-1'

  - job_name: 'redis-1'
    static_configs:
      - targets: ['localhost:6379']
        labels:
          instance: 'redis-1'
```

### Monitoring Dashboard Script

Save as: `scripts/monitor-instances.sh`

```bash
#!/bin/bash

# Real-time monitoring dashboard for multi-instances

while true; do
    clear
    echo "╔════════════════════════════════════════════════════════════════╗"
    echo "║         APM MULTI-INSTANCE MONITORING DASHBOARD               ║"
    echo "║                  $(date '+%Y-%m-%d %H:%M:%S')                       ║"
    echo "╚════════════════════════════════════════════════════════════════╝"
    echo ""

    for i in {1..3}; do
        FRONTEND_PORT=$((3000 + (i-1)*1000))
        BACKEND_PORT=$((5002 + (i-1)*100))
        DB_PORT=$((5432 + (i-1)))
        REDIS_PORT=$((6379 + (i-1)))
        
        echo "┌─ INSTANCE $i ─────────────────────────────────────────────────────┐"
        
        # Check Frontend
        if curl -s http://localhost:$FRONTEND_PORT > /dev/null 2>&1; then
            echo "│ ✅ Frontend (Port $FRONTEND_PORT): RUNNING"
        else
            echo "│ ❌ Frontend (Port $FRONTEND_PORT): FAILED"
        fi
        
        # Check Backend
        if curl -s http://localhost:$BACKEND_PORT/health > /dev/null 2>&1; then
            echo "│ ✅ Backend (Port $BACKEND_PORT): RUNNING"
        else
            echo "│ ❌ Backend (Port $BACKEND_PORT): FAILED"
        fi
        
        # Check Database
        if nc -z localhost $DB_PORT 2>/dev/null; then
            echo "│ ✅ Database (Port $DB_PORT): RUNNING"
        else
            echo "│ ❌ Database (Port $DB_PORT): FAILED"
        fi
        
        # Check Redis
        if redis-cli -p $REDIS_PORT ping > /dev/null 2>&1; then
            echo "│ ✅ Redis (Port $REDIS_PORT): RUNNING"
        else
            echo "│ ❌ Redis (Port $REDIS_PORT): FAILED"
        fi
        
        echo "└────────────────────────────────────────────────────────────────┘"
        echo ""
    done
    
    echo "Press Ctrl+C to exit. Refreshing in 10 seconds..."
    sleep 10
done
```

---

## TROUBLESHOOTING

### Common Issues & Solutions

| Issue | Cause | Solution |
|-------|-------|----------|
| Port conflict | Multiple instances on same port | Use different port offsets in .env |
| Database connection failed | DB not running or wrong credentials | Check docker-compose.yml, restart db service |
| Out of memory | Too many instances | Reduce number of instances or increase server RAM |
| Network issues | Container networking problem | Verify network configuration, rebuild containers |
| Data loss | Volume issues | Use named volumes instead of bind mounts |

### Debug Commands

```bash
# Check all running containers
docker ps

# Check specific instance logs
docker-compose -f multi-instances/instance1/docker-compose.standalone.yml logs -f

# Enter container shell
docker exec -it apm-backend-1 /bin/bash

# Check network connectivity
docker exec apm-backend-1 curl http://db-1:5432

# Database access
docker exec -it apm-db-1 psql -U postgres -d apm_stocks_instance1

# Redis access
docker exec -it apm-redis-1 redis-cli
```

---

## QUICK REFERENCE

```bash
# Initialize setup
chmod +x setup-multi-instances.sh
./setup-multi-instances.sh 3

# Start all instances at once
docker-compose -f docker-compose.multi-instance.yml up -d

# Start individual instance
cd multi-instances/instance1
docker-compose -f docker-compose.standalone.yml up -d

# Stop all
docker-compose -f docker-compose.multi-instance.yml down

# Check all instances
docker ps | grep apm

# View resource usage
docker stats
```

---

**Last Updated:** December 22, 2025
