#!/bin/bash

################################################################################
# DAKS TOP-K STOCKS - Multi-Instance Manager
# Complete orchestration with Interactive Menu
# Version: 2.0
# Date: December 22, 2025
################################################################################

# CONFIGURATION

# PROJECT_DIR="/Users/raghav/Documents/GitHub/APM-TOP-K-STOCKS"
PROJECT_DIR="/nvme1/production/Dashboard/Kuber_Dash/"
MULTI_INSTANCES_DIR="$PROJECT_DIR/multi-instances"
LOG_DIR="$MULTI_INSTANCES_DIR/logs"

# Default server host (can be overridden by DEV/PROD selection)
SERVER_HOST="${SERVER_HOST:-100.93.172.21}"

# Environment mode: "dev" or "prod"
# dev = localhost (for local development)
# prod = server IP (for production deployment)
DEPLOY_MODE=""

# COLOR CODES & STYLING

readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly BLUE='\033[0;34m'
readonly MAGENTA='\033[0;35m'
readonly CYAN='\033[0;36m'
readonly WHITE='\033[1;37m'
readonly BOLD='\033[1m'
readonly DIM='\033[2m'
readonly UNDERLINE='\033[4m'
readonly NC='\033[0m' # No Color

readonly BG_GREEN='\033[42m'
readonly BG_RED='\033[41m'
readonly BG_BLUE='\033[44m'
readonly BG_YELLOW='\033[43m'

# DOCKER CHECK FUNCTIONS

# Check if Docker daemon is running
check_docker() {
    if ! docker info >/dev/null 2>&1; then
        return 1
    fi
    return 0
}

# Check Docker and show error if not running
require_docker() {
    if ! check_docker; then
        echo ""
        echo -e "${RED}  ╔══════════════════════════════════════════════════════════════╗${NC}"
        echo -e "${RED}  ║  ${BOLD}ERROR: Docker is not running!${NC}${RED}                              ║${NC}"
        echo -e "${RED}  ╠══════════════════════════════════════════════════════════════╣${NC}"
        echo -e "${RED}  ║${NC}  Please start Docker Desktop first:                          ${RED}║${NC}"
        echo -e "${RED}  ║${NC}                                                              ${RED}║${NC}"
        echo -e "${RED}  ║${NC}  ${CYAN}Option 1:${NC} Click Docker Desktop icon in Applications       ${RED}║${NC}"
        echo -e "${RED}  ║${NC}  ${CYAN}Option 2:${NC} Run: ${WHITE}open -a Docker${NC}                           ${RED}║${NC}"
        echo -e "${RED}  ║${NC}                                                              ${RED}║${NC}"
        echo -e "${RED}  ║${NC}  ${DIM}Wait ~30 seconds for Docker to fully start${NC}                ${RED}║${NC}"
        echo -e "${RED}  ╚══════════════════════════════════════════════════════════════╝${NC}"
        echo ""
        return 1
    fi
    return 0
}

# Wait for Docker with animation
wait_for_docker() {
    if check_docker; then
        return 0
    fi
    
    echo -e "  ${YELLOW}Waiting for Docker to start...${NC}"
    
    local max_wait=60
    local waited=0
    local spinstr='⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏'
    
    while [ $waited -lt $max_wait ]; do
        if check_docker; then
            echo -e "\r  ${GREEN}✓ Docker is ready!${NC}                    "
            return 0
        fi
        
        local temp=${spinstr#?}
        printf "\r  ${CYAN}[%c]${NC} Waiting for Docker... (%ds)  " "$spinstr" "$waited"
        spinstr=$temp${spinstr%"$temp"}
        
        sleep 1
        ((waited++))
    done
    
    echo -e "\r  ${RED}✗ Docker failed to start within ${max_wait}s${NC}"
    return 1
}

# Get Docker status for display
get_docker_status() {
    if check_docker; then
        echo -e "${GREEN}● Docker Running${NC}"
    else
        echo -e "${RED}○ Docker Stopped${NC}"
    fi
}

# UTILITY FUNCTIONS

print_banner() {
    clear
    local mode_display=""
    if [ "$DEPLOY_MODE" = "dev" ]; then
        mode_display="${GREEN}DEV${NC} ${DIM}(localhost)${NC}"
    elif [ "$DEPLOY_MODE" = "prod" ]; then
        mode_display="${MAGENTA}PROD${NC} ${DIM}($SERVER_HOST)${NC}"
    fi
    
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BOLD}${WHITE}  🚀 MULTI-INSTANCE MANAGER v2.0${NC}"
    echo -e "${DIM}  Docker Orchestration Made Easy${NC}"
    echo -e "${DIM}  Mode: ${NC}$mode_display"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

print_section() {
    echo ""
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BOLD}${WHITE}  $1${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
}

print_success() {
    echo -e "${GREEN}  ✓${NC} $1"
}

print_error() {
    echo -e "${RED}  ✗${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}  ⚠${NC} $1"
}

print_info() {
    echo -e "${CYAN}  ℹ${NC} $1"
}

print_loading() {
    echo -e "${MAGENTA}  ◐${NC} $1"
}

press_enter() {
    echo ""
    echo -e "${DIM}  Press Enter to continue...${NC}"
    read -r
}

# Spinner animation
spinner() {
    local pid=$1
    local delay=0.1
    local spinstr='⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏'
    while [ "$(ps a | awk '{print $1}' | grep $pid)" ]; do
        local temp=${spinstr#?}
        printf " ${CYAN}[%c]${NC}  " "$spinstr"
        local spinstr=$temp${spinstr%"$temp"}
        sleep $delay
        printf "\b\b\b\b\b\b"
    done
    printf "    \b\b\b\b"
}

# ═══════════════════════════════════════════════════════════════════════════════
# DEV/PROD MODE SELECTION
# This determines whether to use localhost (dev) or server IP (prod)
# ═══════════════════════════════════════════════════════════════════════════════

select_deploy_mode() {
    clear
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BOLD}${WHITE}  🚀 DAKS MULTI-INSTANCE MANAGER${NC}"
    echo -e "${DIM}  Select Deployment Mode${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    echo -e "  ${BOLD}${WHITE}🔧 Choose your deployment environment:${NC}"
    echo ""
    echo -e "  ┌────────────────────────────────────────────────────────────────────────┐"
    echo -e "  │  ${YELLOW}1)${NC} ${GREEN}${BOLD}DEV${NC}  - Local Development                                          │"
    echo -e "  │        ${DIM}• Uses localhost for all URLs${NC}                                  │"
    echo -e "  │        ${DIM}• Frontend calls http://localhost:510X${NC}                        │"
    echo -e "  │        ${DIM}• Perfect for testing on your Mac${NC}                             │"
    echo -e "  │                                                                        │"
    echo -e "  │  ${YELLOW}2)${NC} ${MAGENTA}${BOLD}PROD${NC} - Production Server (100.93.172.21)                          │"
    echo -e "  │        ${DIM}• Uses server IP for all URLs${NC}                                 │"
    echo -e "  │        ${DIM}• Frontend calls http://100.93.172.21:510X${NC}                    │"
    echo -e "  │        ${DIM}• For deployment on the Tailscale server${NC}                      │"
    echo -e "  └────────────────────────────────────────────────────────────────────────┘"
    echo ""
    echo -n "  Select mode (1=DEV, 2=PROD) [default: 1]: "
    read -r mode_choice
    
    case "$mode_choice" in
        2|prod|PROD|p|P)
            DEPLOY_MODE="prod"
            SERVER_HOST="100.93.172.21"
            echo ""
            echo -e "  ${MAGENTA}${BOLD}✓${NC} ${BOLD}PRODUCTION MODE${NC} selected"
            echo -e "     ${DIM}All URLs will use: ${CYAN}$SERVER_HOST${NC}"
            ;;
        *)
            DEPLOY_MODE="dev"
            SERVER_HOST="localhost"
            echo ""
            echo -e "  ${GREEN}${BOLD}✓${NC} ${BOLD}DEVELOPMENT MODE${NC} selected"
            echo -e "     ${DIM}All URLs will use: ${CYAN}localhost${NC}"
            ;;
    esac
    echo ""
    sleep 1
}

# ENVIRONMENT MODE SELECTION
# This determines whether to use default (apps/backend/.env) or instance-specific .env

# Global variable to track selected environment mode
# Values: "default" or "instance"
ENV_MODE="default"

# Prompt user to select environment mode
select_env_mode() {
    echo ""
    echo -e "  ${BOLD}${WHITE}📁 Select Environment Mode:${NC}"
    echo ""
    echo -e "     ${YELLOW}1)${NC} ${GREEN}Default${NC}  - Use ${DIM}apps/backend/.env${NC} ${CYAN}(recommended for single instance)${NC}"
    echo -e "     ${YELLOW}2)${NC} ${MAGENTA}Instance${NC} - Use ${DIM}multi-instances/instanceX/.env${NC} ${CYAN}(for multi-instance)${NC}"
    echo ""
    echo -n "  Select mode (1/2) [default: 1]: "
    read -r env_choice
    
    case "$env_choice" in
        2)
            ENV_MODE="instance"
            echo ""
            echo -e "  ${MAGENTA}✓${NC} Using ${BOLD}Instance-Specific${NC} environment files"
            ;;
        *)
            ENV_MODE="default"
            echo ""
            echo -e "  ${GREEN}✓${NC} Using ${BOLD}Default${NC} environment (apps/backend/.env)"
            ;;
    esac
    echo ""
}

# Get the environment file path based on mode
get_env_file_path() {
    local instance=$1
    
    if [ "$ENV_MODE" = "instance" ]; then
        echo "$MULTI_INSTANCES_DIR/$instance/.env"
    else
        echo "$PROJECT_DIR/apps/backend/.env"
    fi
}

# Export environment for Python services
export_env_for_instance() {
    local instance=$1
    local instance_env="$MULTI_INSTANCES_DIR/$instance/.env"
    
    # ALWAYS use instance .env as base (contains INSTANCE_ID, PORTS, DB_CONFIG)
    if [ -f "$instance_env" ]; then
        export DAKS_ENV_FILE="$instance_env"
        export DAKS_ENV_TARGET="$instance_env"
        export DAKS_DATA_DIR="$MULTI_INSTANCES_DIR/$instance/data"
    fi

    # Default Mode: Override API Credentials from backend .env
    # This keeps Instance Infrastructure (IDs/Ports) but uses Shared Credentials
    if [ "$ENV_MODE" = "default" ]; then
        local backend_env="$PROJECT_DIR/apps/backend/.env"
        if [ -f "$backend_env" ]; then
             export FYERS_CLIENT_ID=$(grep "^FYERS_CLIENT_ID=" "$backend_env" | cut -d'=' -f2)
             export FYERS_SECRET_ID=$(grep "^FYERS_SECRET_ID=" "$backend_env" | cut -d'=' -f2)
             export FYERS_REDIRECT_URI=$(grep "^FYERS_REDIRECT_URI=" "$backend_env" | cut -d'=' -f2)
             export FYERS_ACCESS_TOKEN=$(grep "^FYERS_ACCESS_TOKEN=" "$backend_env" | cut -d'=' -f2)
        fi
    else
        # Instance Mode: Clear overrides so values come from instance .env
        unset FYERS_CLIENT_ID
        unset FYERS_SECRET_ID
        unset FYERS_REDIRECT_URI
        unset FYERS_ACCESS_TOKEN
    fi
}

# REPAIR FUNCTION
check_and_repair_instances() {
    local repaired=0
    
    # Iterate through all directories matching instance*
    for dir in "$MULTI_INSTANCES_DIR"/instance*; do
        if [ -d "$dir" ]; then
            local instance_name=$(basename "$dir")
            
            # Check if .env is missing
            if [ ! -f "$dir/.env" ]; then
                # It's a valid instance dir but missing .env - REPAIR IT
                local num=$(echo "$instance_name" | sed 's/instance//')
                
                # Verify it's a number
                if [[ "$num" =~ ^[0-9]+$ ]]; then
                    echo -e "  ${YELLOW}⚠ Detected broken instance: $instance_name (missing .env)${NC}"
                    print_loading "Reparing configuration for $instance_name..."
                    
                    # Calculate default ports (Updated Scheme: 3000 + instance_num)
                    local frontend_port=$((3000 + num))
                    local backend_port=$((5100 + num))
                    local base_fyers_5001=$((8001 + (num - 1) * 100))
                    local base_fyers_5010=$((8010 + (num - 1) * 100))
                    local redis_port=$((6380 + num))
                    
                    # DB_HOST always points to external PostgreSQL server
                    # (Database is on server, not local machine)
                    local db_host="100.93.172.21"
                    
                    # Create .env file
                    cat > "$dir/.env" << EOF
# ═══════════════════════════════════════════════════════════════════════════
# DAKS TOP-K STOCKS - Instance $num Configuration
# Auto-Repaired: $(date)
# Mode: $DEPLOY_MODE | Host: $SERVER_HOST
# ═══════════════════════════════════════════════════════════════════════════

# Instance Identification
INSTANCE_ID=$instance_name
INSTANCE_NAME="DAKS Instance $num"
INSTANCE_REGION=local

# Port Configuration
FRONTEND_PORT=$frontend_port
BACKEND_PORT=$backend_port
FYERS_5001_PORT=$base_fyers_5001
FYERS_5010_PORT=$base_fyers_5010
REDIS_PORT=$redis_port

# Database Configuration - EXTERNAL PostgreSQL
DB_HOST=$db_host
DB_PORT=5432
DB_USERNAME=readonly_user
DB_PASSWORD=db_read_5432
DB_DATABASE=nse_hist_db

# Redis Configuration - Internal Docker
REDIS_HOST=redis
REDIS_PORT_INTERNAL=6379
REDIS_URL=redis://redis:6379
REDIS_PASSWORD=

# Fyers API Configuration
FYERS_CLIENT_ID=YOUR_FYERS_CLIENT_ID_HERE
FYERS_SECRET_ID=YOUR_FYERS_SECRET_ID_HERE
FYERS_REDIRECT_URI=https://raghavjaiswal709.github.io/DAKSphere_redirect
FYERS_ACCESS_TOKEN=YOUR_FYERS_ACCESS_TOKEN_HERE

# Environment Configuration
NODE_ENV=development
PYTHONUNBUFFERED=1
PYTHONDONTWRITEBYTECODE=1
TZ=Asia/Kolkata

# Service URLs (Browser-accessible - use SERVER_HOST)
NEXT_PUBLIC_API_URL=http://$SERVER_HOST:$backend_port
NEXT_PUBLIC_WS_URL=ws://$SERVER_HOST:$backend_port
NEXT_PUBLIC_BACKEND_URL=http://$SERVER_HOST:$backend_port
NEXT_PUBLIC_GTT_API_URL=http://$SERVER_HOST:$backend_port
NEXT_PUBLIC_FYERS_SERVICE_5001_URL=http://$SERVER_HOST:$base_fyers_5001
NEXT_PUBLIC_FYERS_SERVICE_5010_URL=http://$SERVER_HOST:$base_fyers_5010
NEXT_PUBLIC_FYERS_SOCKET_URL=http://$SERVER_HOST:$base_fyers_5001
NEXT_PUBLIC_LIVE_MARKET_SOCKET_URL=http://$SERVER_HOST:$base_fyers_5010

# Internal Docker Service URLs
BACKEND_URL=http://backend:5002
FYERS_SERVICE_5001_URL=http://fyers-5001:5001
FYERS_SERVICE_5010_URL=http://fyers-5010:5010

# External API URLs (adjust for dev/prod)
SIPR_API_URL=http://$SERVER_HOST:8510
PREDICTION_API_URL=http://$SERVER_HOST:5112
PREMARKET_API_URL=http://$SERVER_HOST:5717

# Logging
LOG_LEVEL=debug
LOG_DIR=/app/logs

# Performance
MAX_CONNECTIONS=100
REDIS_MAX_MEMORY=512mb
WORKER_THREADS=4

# User Information
NEXT_PUBLIC_INSTANCE_USER_NAME="Instance $num User"
NEXT_PUBLIC_INSTANCE_USER_EMAIL="user$num@daks.com"
EOF
                    print_success "Repaired $instance_name successfully"
                    ((repaired++))
                fi
            fi
        fi
    done
    
    if [ $repaired -gt 0 ]; then
        echo ""
        print_success "Repaired $repaired instance(s). Press Enter to continue..."
        read -r
    fi
}

# INSTANCE DISCOVERY

# Get all available instance directories
get_all_instances() {
    local instances=()
    for dir in "$MULTI_INSTANCES_DIR"/instance*; do
        if [ -d "$dir" ] && [ -f "$dir/.env" ]; then
            instances+=("$(basename "$dir")")
        fi
    done
    echo "${instances[@]}"
}

# Count instances
count_instances() {
    local count=0
    for dir in "$MULTI_INSTANCES_DIR"/instance*; do
        if [ -d "$dir" ] && [ -f "$dir/.env" ]; then
            ((count++))
        fi
    done
    echo $count
}

# Get instance number from name (instance1 -> 1)
get_instance_number() {
    echo "${1//instance/}"
}

# Check if instance is running (any container up)
is_instance_running() {
    local instance=$1
    local instance_dir="$MULTI_INSTANCES_DIR/$instance"
    
    if [ ! -d "$instance_dir" ]; then
        return 1
    fi
    
    # Use subshell to avoid changing directory permanently
    local running_count
    running_count=$(cd "$instance_dir" && docker compose -f docker-compose.standalone.yml ps -q 2>/dev/null | wc -l | tr -d ' ')
    
    if [ "$running_count" -gt 0 ] 2>/dev/null; then
        return 0
    else
        return 1
    fi
}

# Get instance config value
get_instance_config() {
    local instance=$1
    local key=$2
    local instance_dir="$MULTI_INSTANCES_DIR/$instance"
    
    if [ -f "$instance_dir/.env" ]; then
        grep "^${key}=" "$instance_dir/.env" 2>/dev/null | cut -d'=' -f2-
    fi
}

# Count running containers for an instance
get_running_container_count() {
    local instance=$1
    local instance_dir="$MULTI_INSTANCES_DIR/$instance"
    
    # Use subshell to avoid changing directory permanently
    (cd "$instance_dir" 2>/dev/null && docker compose -f docker-compose.standalone.yml ps -q 2>/dev/null | wc -l | tr -d ' ') || echo "0"
}

# STATUS DISPLAY

show_status_summary() {
    local total=0
    local running=0
    local stopped=0
    
    # Only count if Docker is running
    if check_docker; then
        for instance in $(get_all_instances); do
            ((total++))
            if is_instance_running "$instance"; then
                ((running++))
            else
                ((stopped++))
            fi
        done
    else
        # Count instances without checking running status
        for instance in $(get_all_instances); do
            ((total++))
            ((stopped++))
        done
    fi
    
    local docker_status=$(get_docker_status)
    echo -e "  $docker_status │ ${WHITE}$total${NC} instances │ ${GREEN}$running running${NC} │ ${RED}$stopped stopped${NC}"
}

show_detailed_status() {
    print_section "📊 Instance Status Overview"
    
    local instances=($(get_all_instances))
    
    if [ ${#instances[@]} -eq 0 ]; then
        print_warning "No instances found. Create one first!"
        return
    fi
    
    echo -e "  ${BOLD}${WHITE}┌─────────────┬────────────┬──────────────┬──────────────┬───────────────┐${NC}"
    echo -e "  ${BOLD}${WHITE}│  Instance   │   Status   │   Frontend   │   Backend    │   Containers  │${NC}"
    echo -e "  ${BOLD}${WHITE}├─────────────┼────────────┼──────────────┼──────────────┼───────────────┤${NC}"
    
    for instance in "${instances[@]}"; do
        local frontend_port=$(get_instance_config "$instance" "FRONTEND_PORT")
        local backend_port=$(get_instance_config "$instance" "BACKEND_PORT")
        local container_count=$(get_running_container_count "$instance")
        
        local status_icon
        local status_text
        
        if is_instance_running "$instance"; then
            status_icon="${GREEN}●${NC}"
            status_text="${GREEN}Running${NC}"
        else
            status_icon="${RED}○${NC}"
            status_text="${RED}Stopped${NC}"
        fi
        
        local num=$(get_instance_number "$instance")
        printf "  ${WHITE}│${NC}  ${CYAN}%-9s${NC} ${WHITE}│${NC} $status_icon %-8b ${WHITE}│${NC}   ${YELLOW}:%-8s${NC} ${WHITE}│${NC}   ${YELLOW}:%-8s${NC} ${WHITE}│${NC}   ${MAGENTA}%-10s${NC} ${WHITE}│${NC}\n" \
            "Instance $num" "$status_text" "$frontend_port" "$backend_port" "$container_count running"
    done
    
    echo -e "  ${BOLD}${WHITE}└─────────────┴────────────┴──────────────┴──────────────┴───────────────┘${NC}"
    echo ""
    
    # Quick URLs for running instances
    local has_running=false
    for instance in "${instances[@]}"; do
        if is_instance_running "$instance"; then
            if [ "$has_running" = false ]; then
                echo -e "  ${BOLD}${WHITE}🔗 Quick Access URLs:${NC}"
                echo -e "     ${DIM}Server: $SERVER_HOST${NC}"
                has_running=true
            fi
            local num=$(get_instance_number "$instance")
            local frontend_port=$(get_instance_config "$instance" "FRONTEND_PORT")
            local backend_port=$(get_instance_config "$instance" "BACKEND_PORT")
            echo -e "     ${CYAN}Instance $num:${NC} http://$SERVER_HOST:$frontend_port ${DIM}(API: :$backend_port)${NC}"
        fi
    done
}

# INSTANCE OPERATIONS

start_single_instance() {
    local instance=$1
    local silent=${2:-false}
    local instance_dir="$MULTI_INSTANCES_DIR/$instance"
    local num=$(get_instance_number "$instance")
    
    # Check Docker first
    if ! check_docker; then
        [ "$silent" = false ] && print_error "Docker is not running!"
        return 1
    fi
    
    if [ ! -d "$instance_dir" ]; then
        [ "$silent" = false ] && print_error "Instance directory not found: $instance_dir"
        return 1
    fi
    
    if is_instance_running "$instance"; then
        [ "$silent" = false ] && print_warning "Instance $num is already running"
        return 0
    fi
    
    [ "$silent" = false ] && print_loading "Starting Instance $num..."
    
    # ✅ MULTI-INSTANCE SUPPORT: Export environment based on selected mode
    export_env_for_instance "$instance"
    local env_file=$(get_env_file_path "$instance")
    [ "$silent" = false ] && echo -e "     ${DIM}Using env: $env_file${NC}"
    
    # Use pushd/popd to preserve current directory
    pushd "$instance_dir" > /dev/null 2>&1 || return 1
    
    # Capture output to temp file for reliable error display
    local log_file="/tmp/daks_instance_${instance}_start.log"
    
    if docker compose -f docker-compose.standalone.yml up -d > "$log_file" 2>&1; then
        local exit_code=0
    else
        local exit_code=1
    fi
    
    # Get port info before popd
    local frontend_port=""
    local backend_port=""
    if [ -f ".env" ]; then
        frontend_port=$(grep "^FRONTEND_PORT=" .env 2>/dev/null | cut -d'=' -f2)
        backend_port=$(grep "^BACKEND_PORT=" .env 2>/dev/null | cut -d'=' -f2)
    fi
    
    popd > /dev/null 2>&1
    
    if [ $exit_code -eq 0 ]; then
        [ "$silent" = false ] && print_success "Instance $num started successfully"
        rm -f "$log_file"
        
        if [ "$silent" = false ] && [ -n "$frontend_port" ]; then
            echo -e "     ${DIM}Frontend: http://$SERVER_HOST:$frontend_port${NC}"
            echo -e "     ${DIM}Backend:  http://$SERVER_HOST:$backend_port${NC}"
        fi
        return 0
    else
        [ "$silent" = false ] && print_error "Failed to start Instance $num"
        if [ "$silent" = false ]; then
            echo -e "     ${DIM}Error details:${NC}"
            echo -e "${RED}----------------------------------------${NC}"
            cat "$log_file"
            echo -e "${RED}----------------------------------------${NC}"
        fi
        rm -f "$log_file"
        return 1
    fi
}

stop_single_instance() {
    local instance=$1
    local silent=${2:-false}
    local instance_dir="$MULTI_INSTANCES_DIR/$instance"
    local num=$(get_instance_number "$instance")
    
    if [ ! -d "$instance_dir" ]; then
        [ "$silent" = false ] && print_error "Instance directory not found"
        return 1
    fi
    
    if ! is_instance_running "$instance"; then
        [ "$silent" = false ] && print_warning "Instance $num is not running"
        return 0
    fi
    
    [ "$silent" = false ] && print_loading "Stopping Instance $num..."
    
    # Use pushd/popd to preserve current directory
    pushd "$instance_dir" > /dev/null 2>&1 || return 1
    
    local result=0
    if docker compose -f docker-compose.standalone.yml down >/dev/null 2>&1; then
        [ "$silent" = false ] && print_success "Instance $num stopped"
    else
        [ "$silent" = false ] && print_error "Failed to stop Instance $num"
        result=1
    fi
    
    popd > /dev/null 2>&1
    return $result
}

restart_single_instance() {
    local instance=$1
    local instance_dir="$MULTI_INSTANCES_DIR/$instance"
    local num=$(get_instance_number "$instance")
    
    print_loading "Restarting Instance $num..."
    
    # Use pushd/popd to preserve current directory
    pushd "$instance_dir" > /dev/null 2>&1 || return 1
    
    docker compose -f docker-compose.standalone.yml restart >/dev/null 2>&1
    local exit_code=$?
    
    popd > /dev/null 2>&1
    
    if [ $exit_code -eq 0 ]; then
        print_success "Instance $num restarted"
        return 0
    else
        print_error "Failed to restart Instance $num"
        return 1
    fi
}

# BULK OPERATIONS

start_all_instances() {
    print_section "▶▶ Starting All Instances"
    
    # Check if Docker is running first
    if ! require_docker; then
        echo -e "  ${YELLOW}Would you like to start Docker and wait? (y/N):${NC} \c"
        read -r start_docker
        if [[ "$start_docker" =~ ^[Yy]$ ]]; then
            echo ""
            print_loading "Starting Docker Desktop..."
            open -a Docker 2>/dev/null
            if ! wait_for_docker; then
                print_error "Could not start Docker. Please start it manually."
                return 1
            fi
        else
            return 1
        fi
    fi
    
    local instances=($(get_all_instances))
    
    if [ ${#instances[@]} -eq 0 ]; then
        print_warning "No instances found"
        return
    fi
    
    # ✅ MULTI-INSTANCE SUPPORT: Select environment mode
    select_env_mode
    
    local started=0
    local skipped=0
    local failed=0
    
    for instance in "${instances[@]}"; do
        local num=$(get_instance_number "$instance")
        
        if is_instance_running "$instance"; then
            echo -e "  ${YELLOW}⏭${NC}  Instance $num - Already running, skipping"
            ((skipped++))
        else
            print_loading "Starting Instance $num..."
            if start_single_instance "$instance" true; then
                print_success "Instance $num started"
                ((started++))
            else
                print_error "Instance $num failed to start"
                ((failed++))
            fi
        fi
    done
    
    echo ""
    echo -e "  ${BOLD}Summary:${NC} ${GREEN}$started started${NC} │ ${YELLOW}$skipped skipped${NC} │ ${RED}$failed failed${NC}"
    
    if [ $started -gt 0 ]; then
        echo ""
        print_info "Waiting for services to initialize..."
        sleep 3
        echo ""
        echo -e "  ${BOLD}${WHITE}🔗 Access URLs:${NC} ${DIM}(Server: $SERVER_HOST)${NC}"
        for instance in "${instances[@]}"; do
            if is_instance_running "$instance"; then
                local num=$(get_instance_number "$instance")
                local port=$(get_instance_config "$instance" "FRONTEND_PORT")
                echo -e "     ${CYAN}Instance $num:${NC} http://$SERVER_HOST:$port"
            fi
        done
    fi
}

stop_all_instances() {
    print_section "■■ Stopping All Instances"
    
    local instances=($(get_all_instances))
    local running_count=0
    
    for instance in "${instances[@]}"; do
        if is_instance_running "$instance"; then
            ((running_count++))
        fi
    done
    
    if [ $running_count -eq 0 ]; then
        print_info "No running instances to stop"
        return
    fi
    
    echo -e "  ${YELLOW}⚠ This will stop $running_count running instance(s)${NC}"
    echo ""
    echo -e "  ${CYAN}Continue? (y/N):${NC} \c"
    read -r confirm
    
    if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
        print_info "Operation cancelled"
        return
    fi
    
    echo ""
    local stopped=0
    local failed=0
    
    for instance in "${instances[@]}"; do
        if is_instance_running "$instance"; then
            local num=$(get_instance_number "$instance")
            print_loading "Stopping Instance $num..."
            if stop_single_instance "$instance" true; then
                print_success "Instance $num stopped"
                ((stopped++))
            else
                print_error "Instance $num failed to stop"
                ((failed++))
            fi
        fi
    done
    
    echo ""
    echo -e "  ${BOLD}Summary:${NC} ${GREEN}$stopped stopped${NC} │ ${RED}$failed failed${NC}"
}

restart_all_instances() {
    print_section "🔄 Restarting All Instances"
    
    local instances=($(get_all_instances))
    
    if [ ${#instances[@]} -eq 0 ]; then
        print_warning "No instances found"
        return
    fi
    
    echo -e "  ${YELLOW}⚠ This will restart ${#instances[@]} instance(s)${NC}"
    echo ""
    echo -e "  ${CYAN}Continue? (y/N):${NC} \c"
    read -r confirm
    
    if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
        print_info "Operation cancelled"
        return
    fi
    
    echo ""
    
    for instance in "${instances[@]}"; do
        restart_single_instance "$instance"
    done
}

# INSTANCE SELECTION MENU

select_instance() {
    local filter=$1  # "all", "running", "stopped"
    local action=$2  # Description for the prompt
    
    local instances=()
    local display_instances=()
    
    for instance in $(get_all_instances); do
        case "$filter" in
            running)
                if is_instance_running "$instance"; then
                    instances+=("$instance")
                fi
                ;;
            stopped)
                if ! is_instance_running "$instance"; then
                    instances+=("$instance")
                fi
                ;;
            *)
                instances+=("$instance")
                ;;
        esac
    done
    
    if [ ${#instances[@]} -eq 0 ]; then
        return 1
    fi
    
    # Display menu to stderr so it doesn't interfere with stdout capture
    echo "" >&2
    echo -e "  ${BOLD}Available Instances:${NC}" >&2
    echo "" >&2
    
    local idx=1
    for instance in "${instances[@]}"; do
        local num=$(get_instance_number "$instance")
        local port=$(get_instance_config "$instance" "FRONTEND_PORT")
        local status_icon
        
        if is_instance_running "$instance"; then
            status_icon="${GREEN}●${NC}"
        else
            status_icon="${RED}○${NC}"
        fi
        
        echo -e "     ${YELLOW}$idx)${NC} $status_icon Instance $num ${DIM}(Port: $port)${NC}" >&2
        ((idx++))
    done
    
    echo "" >&2
    echo -n "  Select instance to $action (1-${#instances[@]}) or 'q' to cancel: " >&2
    read -r choice
    
    if [ "$choice" = "q" ] || [ "$choice" = "Q" ]; then
        return 2
    fi
    
    if ! [[ "$choice" =~ ^[0-9]+$ ]] || [ "$choice" -lt 1 ] || [ "$choice" -gt ${#instances[@]} ]; then
        echo -e "${RED}  ✗ Invalid selection. Please enter a number between 1 and ${#instances[@]}${NC}" >&2
        return 1
    fi
    
    # Only output the selected instance to stdout
    echo "${instances[$((choice-1))]}"
    return 0
}

# MENU HANDLERS

menu_start_instance() {
    print_section "▶ Start Instance"
    
    # Check Docker first
    if ! require_docker; then
        read -p "  Press Enter to continue..."
        return
    fi
    
    local stopped_count=0
    for instance in $(get_all_instances); do
        if ! is_instance_running "$instance"; then
            ((stopped_count++))
        fi
    done
    
    if [ $stopped_count -eq 0 ]; then
        echo ""
        print_info "All instances are already running!"
        echo ""
        read -p "  Press Enter to continue..."
        return
    fi
    
    # Capture instance selection
    local instance
    instance=$(select_instance "stopped" "start")
    local result=$?
    
    # Debug output
    echo "" >&2
    echo -e "${DIM}  [Debug] Selection result: $result, Instance: '$instance'${NC}" >&2
    
    if [ $result -eq 2 ]; then
        echo ""
        print_info "Operation cancelled"
        sleep 1
        return
    fi
    
    if [ $result -ne 0 ] || [ -z "$instance" ]; then
        echo ""
        print_error "Invalid selection or no instance returned"
        sleep 2
        return
    fi
    
    # ✅ MULTI-INSTANCE SUPPORT: Select environment mode
    select_env_mode
    
    echo ""
    echo -e "${CYAN}  Starting: $instance${NC}" >&2
    start_single_instance "$instance"
    echo ""
    read -p "  Press Enter to continue..."
}

menu_stop_instance() {
    print_section "■ Stop Instance"
    
    # Check Docker first
    if ! require_docker; then
        read -p "  Press Enter to continue..."
        return
    fi
    
    local running_count=0
    for instance in $(get_all_instances); do
        if is_instance_running "$instance"; then
            ((running_count++))
        fi
    done
    
    if [ $running_count -eq 0 ]; then
        echo ""
        print_info "No running instances to stop"
        echo ""
        read -p "  Press Enter to continue..."
        return
    fi
    
    local instance
    instance=$(select_instance "running" "stop")
    local result=$?
    
    if [ $result -eq 2 ]; then
        echo ""
        print_info "Operation cancelled"
        sleep 1
        return
    fi
    
    if [ $result -ne 0 ] || [ -z "$instance" ]; then
        echo ""
        print_error "Invalid selection"
        sleep 1
        return
    fi
    
    echo ""
    stop_single_instance "$instance"
    echo ""
    read -p "  Press Enter to continue..."
}

menu_restart_instance() {
    print_section "🔄 Restart Instance"
    
    # Check Docker first
    if ! require_docker; then
        read -p "  Press Enter to continue..."
        return
    fi
    
    local instance
    instance=$(select_instance "all" "restart")
    local result=$?
    
    if [ $result -eq 2 ]; then
        echo ""
        print_info "Operation cancelled"
        sleep 1
        return
    fi
    
    if [ $result -ne 0 ] || [ -z "$instance" ]; then
        echo ""
        print_error "Invalid selection"
        sleep 1
        return
    fi
    
    echo ""
    restart_single_instance "$instance"
    echo ""
    read -p "  Press Enter to continue..."
}

menu_view_logs() {
    print_section "📋 View Instance Logs"
    
    local instance
    instance=$(select_instance "all" "view logs")
    local result=$?
    
    if [ $result -eq 2 ]; then
        print_info "Operation cancelled"
        return
    fi
    
    if [ $result -ne 0 ] || [ -z "$instance" ]; then
        return
    fi
    
    local num=$(get_instance_number "$instance")
    local instance_dir="$MULTI_INSTANCES_DIR/$instance"
    
    echo ""
    echo -e "  ${BOLD}Select service to view logs:${NC}"
    echo ""
    echo -e "     ${YELLOW}1)${NC} All services (combined)"
    echo -e "     ${YELLOW}2)${NC} Frontend"
    echo -e "     ${YELLOW}3)${NC} Backend"
    echo -e "     ${YELLOW}4)${NC} Database"
    echo -e "     ${YELLOW}5)${NC} Redis"
    echo -e "     ${YELLOW}6)${NC} Fyers 5001"
    echo -e "     ${YELLOW}7)${NC} Fyers 5010"
    echo ""
    echo -e "  ${CYAN}Select service (1-7):${NC} \c"
    read -r service_choice
    
    local service=""
    case "$service_choice" in
        1) service="" ;;
        2) service="frontend" ;;
        3) service="backend" ;;
        4) service="db" ;;
        5) service="redis" ;;
        6) service="fyers-5001" ;;
        7) service="fyers-5010" ;;
        *) print_error "Invalid selection"; return ;;
    esac
    
    cd "$instance_dir"
    
    echo ""
    echo -e "  ${BOLD}${CYAN}═══ Logs for Instance $num ${service:+- $service} ═══${NC}"
    echo -e "  ${DIM}(Press Ctrl+C to exit)${NC}"
    echo ""
    
    if [ -z "$service" ]; then
        docker compose -f docker-compose.standalone.yml logs -f --tail=100
    else
        docker compose -f docker-compose.standalone.yml logs -f --tail=100 $service
    fi
}

menu_health_check() {
    print_section "🏥 Health Check"
    
    local instances=($(get_all_instances))
    
    if [ ${#instances[@]} -eq 0 ]; then
        print_warning "No instances found"
        return
    fi
    
    echo -e "  ${DIM}Testing against: $SERVER_HOST${NC}"
    echo ""
    
    local total_checks=0
    local passed_checks=0
    
    for instance in "${instances[@]}"; do
        local num=$(get_instance_number "$instance")
        local instance_dir="$MULTI_INSTANCES_DIR/$instance"
        
        if [ ! -f "$instance_dir/.env" ]; then
            continue
        fi
        
        source "$instance_dir/.env"
        
        echo -e "  ${BOLD}${CYAN}Instance $num:${NC}"
        
        # Frontend check
        ((total_checks++))
        if curl -s --connect-timeout 2 "http://$SERVER_HOST:$FRONTEND_PORT" >/dev/null 2>&1; then
            print_success "Frontend (:$FRONTEND_PORT)"
            ((passed_checks++))
        else
            print_error "Frontend (:$FRONTEND_PORT)"
        fi
        
        # Backend check
        ((total_checks++))
        if curl -s --connect-timeout 2 "http://$SERVER_HOST:$BACKEND_PORT/health" >/dev/null 2>&1 || \
           curl -s --connect-timeout 2 "http://$SERVER_HOST:$BACKEND_PORT" >/dev/null 2>&1; then
            print_success "Backend (:$BACKEND_PORT)"
            ((passed_checks++))
        else
            print_error "Backend (:$BACKEND_PORT)"
        fi
        
        # Database check (External PostgreSQL at SERVER_HOST:5432)
        ((total_checks++))
        if nc -z $SERVER_HOST 5432 >/dev/null 2>&1; then
            print_success "Database ($SERVER_HOST:5432 - external)"
            ((passed_checks++))
        else
            print_error "Database ($SERVER_HOST:5432 - external)"
        fi
        
        # Redis check
        ((total_checks++))
        if nc -z $SERVER_HOST $REDIS_PORT >/dev/null 2>&1; then
            print_success "Redis (:$REDIS_PORT)"
            ((passed_checks++))
        else
            print_error "Redis (:$REDIS_PORT)"
        fi
        
        echo ""
    done
    
    # Summary
    if [ $total_checks -gt 0 ]; then
        local percent=$((passed_checks * 100 / total_checks))
        echo -e "  ${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        echo -e "  ${BOLD}Overall Health:${NC} $passed_checks/$total_checks checks passed ($percent%)"
        
        if [ $percent -eq 100 ]; then
            echo -e "  ${GREEN}${BOLD}✓ All systems operational!${NC}"
        elif [ $percent -ge 75 ]; then
            echo -e "  ${YELLOW}${BOLD}⚠ Most systems operational${NC}"
        elif [ $percent -ge 50 ]; then
            echo -e "  ${YELLOW}${BOLD}⚠ Some services are down${NC}"
        else
            echo -e "  ${RED}${BOLD}✗ Critical: Multiple services down${NC}"
        fi
    fi
}

menu_resource_usage() {
    print_section "📊 Resource Usage"
    
    print_info "Fetching container statistics..."
    echo ""
    
    docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}\t{{.BlockIO}}" 2>/dev/null | \
        grep -E "(NAME|instance)" || print_warning "No running containers found"
}

menu_db_operations() {
    print_section "🗄️ Database Operations"
    
    local instance
    instance=$(select_instance "all" "manage database")
    local result=$?
    
    if [ $result -eq 2 ]; then
        print_info "Operation cancelled"
        return
    fi
    
    if [ $result -ne 0 ] || [ -z "$instance" ]; then
        return
    fi
    
    local num=$(get_instance_number "$instance")
    local instance_dir="$MULTI_INSTANCES_DIR/$instance"
    
    echo ""
    echo -e "  ${BOLD}Database Operations for Instance $num:${NC}"
    echo ""
    echo -e "     ${YELLOW}1)${NC} Open Database Shell (psql)"
    echo -e "     ${YELLOW}2)${NC} Backup Database"
    echo -e "     ${YELLOW}3)${NC} Show Database Size"
    echo -e "     ${YELLOW}4)${NC} Cancel"
    echo ""
    echo -e "  ${CYAN}Select operation (1-4):${NC} \c"
    read -r db_choice
    
    cd "$instance_dir"
    source .env 2>/dev/null
    
    case "$db_choice" in
        1)
            echo ""
            print_info "Opening database shell... (type \\q to exit)"
            echo ""
            docker compose -f docker-compose.standalone.yml exec db psql -U $POSTGRES_USER -d $POSTGRES_DB
            ;;
        2)
            mkdir -p "$instance_dir/backups"
            local backup_file="$instance_dir/backups/backup_$(date +%Y%m%d_%H%M%S).sql"
            print_loading "Creating backup..."
            
            if docker compose -f docker-compose.standalone.yml exec -T db pg_dump -U $POSTGRES_USER $POSTGRES_DB > "$backup_file" 2>/dev/null; then
                print_success "Backup created: $backup_file"
                echo -e "     ${DIM}Size: $(ls -lh "$backup_file" | awk '{print $5}')${NC}"
            else
                print_error "Backup failed"
                rm -f "$backup_file"
            fi
            ;;
        3)
            echo ""
            docker compose -f docker-compose.standalone.yml exec db psql -U $POSTGRES_USER -d $POSTGRES_DB -c "SELECT pg_size_pretty(pg_database_size('$POSTGRES_DB')) as database_size;" 2>/dev/null
            ;;
        *)
            print_info "Operation cancelled"
            ;;
    esac
}

menu_open_shell() {
    print_section "🖥️ Open Container Shell"
    
    local instance
    instance=$(select_instance "running" "open shell")
    local result=$?
    
    if [ $result -eq 2 ]; then
        print_info "Operation cancelled"
        return
    fi
    
    if [ $result -ne 0 ] || [ -z "$instance" ]; then
        print_warning "No running instances available"
        return
    fi
    
    local num=$(get_instance_number "$instance")
    local instance_dir="$MULTI_INSTANCES_DIR/$instance"
    
    echo ""
    echo -e "  ${BOLD}Select container:${NC}"
    echo ""
    echo -e "     ${YELLOW}1)${NC} Backend"
    echo -e "     ${YELLOW}2)${NC} Frontend"
    echo -e "     ${YELLOW}3)${NC} Database"
    echo -e "     ${YELLOW}4)${NC} Redis"
    echo -e "     ${YELLOW}5)${NC} Cancel"
    echo ""
    echo -e "  ${CYAN}Select container (1-5):${NC} \c"
    read -r container_choice
    
    local service=""
    local shell_cmd="/bin/sh"
    
    case "$container_choice" in
        1) service="backend"; shell_cmd="/bin/bash" ;;
        2) service="frontend"; shell_cmd="/bin/sh" ;;
        3) service="db"; shell_cmd="/bin/bash" ;;
        4) service="redis"; shell_cmd="/bin/sh" ;;
        *) print_info "Operation cancelled"; return ;;
    esac
    
    cd "$instance_dir"
    
    echo ""
    print_info "Opening shell in $service container... (type 'exit' to leave)"
    echo ""
    
    docker compose -f docker-compose.standalone.yml exec $service $shell_cmd 2>/dev/null || \
    docker compose -f docker-compose.standalone.yml exec $service /bin/sh
}

menu_create_instance() {
    print_section "➕ Create New Instance"
    
    # Find next available instance number
    local max_num=0
    for dir in "$MULTI_INSTANCES_DIR"/instance*; do
        if [ -d "$dir" ]; then
            local num=$(basename "$dir" | sed 's/instance//')
            if [ "$num" -gt "$max_num" ]; then
                max_num=$num
            fi
        fi
    done
    
    local new_num=$((max_num + 1))
    local new_instance="instance$new_num"
    local new_dir="$MULTI_INSTANCES_DIR/$new_instance"
    
    echo -e "  Creating ${CYAN}Instance $new_num${NC} in ${BOLD}$DEPLOY_MODE${NC} mode"
    echo ""
    
    # Calculate default ports based on instance number
    # Frontend: 3000 + instance_num (e.g., 3001, 3002, 3003)
    # Backend: 5100 + instance_num (e.g., 5101, 5102, 5103)
    local base_frontend=$((3000 + new_num))
    local base_backend=$((5100 + new_num))
    local base_fyers_5001=$((8001 + (new_num - 1) * 100))
    local base_fyers_5010=$((8010 + (new_num - 1) * 100))
    local base_redis=$((6380 + new_num))
    
    echo -e "  ${CYAN}Frontend Port ${DIM}(default: $base_frontend)${NC}: \c"
    read -r frontend_port
    frontend_port=${frontend_port:-$base_frontend}
    
    echo -e "  ${CYAN}Backend Port ${DIM}(default: $base_backend)${NC}: \c"
    read -r backend_port
    backend_port=${backend_port:-$base_backend}
    
    echo -e "  ${CYAN}Redis Port ${DIM}(default: $base_redis)${NC}: \c"
    read -r redis_port
    redis_port=${redis_port:-$base_redis}
    
    echo ""
    print_loading "Creating instance structure..."
    
    # Create directory structure
    mkdir -p "$new_dir"/{config,data,logs,backups}
    
    # Copy docker compose from template (instance1)
    if [ -f "$MULTI_INSTANCES_DIR/instance1/docker-compose.standalone.yml" ]; then
        cp "$MULTI_INSTANCES_DIR/instance1/docker-compose.standalone.yml" "$new_dir/"
    else
        print_error "Template docker-compose.standalone.yml not found in instance1"
        return 1
    fi
    
    # DB_HOST always points to external PostgreSQL server
    # (Database is on server, not local machine)
    local db_host="100.93.172.21"
    
    # Create .env file with external DB configuration
    cat > "$new_dir/.env" << EOF
# ═══════════════════════════════════════════════════════════════════════════
# DAKS TOP-K STOCKS - Instance $new_num Configuration
# Created: $(date)
# Mode: $DEPLOY_MODE | Host: $SERVER_HOST
# ═══════════════════════════════════════════════════════════════════════════

# Instance Identification
INSTANCE_ID=$new_instance
INSTANCE_NAME="DAKS Instance $new_num"
INSTANCE_REGION=local

# Port Configuration
FRONTEND_PORT=$frontend_port
BACKEND_PORT=$backend_port
FYERS_5001_PORT=$base_fyers_5001
FYERS_5010_PORT=$base_fyers_5010
REDIS_PORT=$redis_port

# Database Configuration - EXTERNAL PostgreSQL
# In DEV mode: connects to PostgreSQL on host machine via host.docker.internal
# In PROD mode: connects directly to server IP
DB_HOST=$db_host
DB_PORT=5432
DB_USERNAME=readonly_user
DB_PASSWORD=db_read_5432
DB_DATABASE=nse_hist_db

# Redis Configuration - Internal Docker
REDIS_HOST=redis
REDIS_PORT_INTERNAL=6379
REDIS_URL=redis://redis:6379
REDIS_PASSWORD=

# Fyers API Configuration
FYERS_CLIENT_ID=YOUR_FYERS_CLIENT_ID_HERE
FYERS_SECRET_ID=YOUR_FYERS_SECRET_ID_HERE
FYERS_REDIRECT_URI=https://raghavjaiswal709.github.io/DAKSphere_redirect
FYERS_ACCESS_TOKEN=YOUR_FYERS_ACCESS_TOKEN_HERE

# Environment Configuration
NODE_ENV=development
PYTHONUNBUFFERED=1
PYTHONDONTWRITEBYTECODE=1
TZ=Asia/Kolkata

# Service URLs (Browser-accessible)
# In DEV: uses localhost so browser can reach the services
# In PROD: uses server IP
NEXT_PUBLIC_API_URL=http://$SERVER_HOST:$backend_port
NEXT_PUBLIC_WS_URL=ws://$SERVER_HOST:$backend_port
NEXT_PUBLIC_BACKEND_URL=http://$SERVER_HOST:$backend_port
NEXT_PUBLIC_GTT_API_URL=http://$SERVER_HOST:$backend_port
NEXT_PUBLIC_FYERS_SERVICE_5001_URL=http://$SERVER_HOST:$base_fyers_5001
NEXT_PUBLIC_FYERS_SERVICE_5010_URL=http://$SERVER_HOST:$base_fyers_5010
NEXT_PUBLIC_FYERS_SOCKET_URL=http://$SERVER_HOST:$base_fyers_5001
NEXT_PUBLIC_LIVE_MARKET_SOCKET_URL=http://$SERVER_HOST:$base_fyers_5010

# Internal Docker Service URLs
BACKEND_URL=http://backend:5002
FYERS_SERVICE_5001_URL=http://fyers-5001:5001
FYERS_SERVICE_5010_URL=http://fyers-5010:5010

# External API URLs (use localhost in dev, server IP in prod)
SIPR_API_URL=http://$SERVER_HOST:8510
PREDICTION_API_URL=http://$SERVER_HOST:5112
PREMARKET_API_URL=http://$SERVER_HOST:5717

# Logging
LOG_LEVEL=debug
LOG_DIR=/app/logs

# Performance
MAX_CONNECTIONS=100
REDIS_MAX_MEMORY=512mb
WORKER_THREADS=4

# User Information
NEXT_PUBLIC_INSTANCE_USER_NAME="Instance $new_num User"
NEXT_PUBLIC_INSTANCE_USER_EMAIL="user$new_num@daks.com"
EOF
    
    print_success "Instance $new_num created successfully!"
    echo ""
    echo -e "  ${BOLD}Configuration:${NC}"
    echo -e "     Mode:       ${BOLD}$DEPLOY_MODE${NC}"
    echo -e "     Directory:  ${DIM}$new_dir${NC}"
    echo -e "     Frontend:   ${CYAN}http://$SERVER_HOST:$frontend_port${NC}"
    echo -e "     Backend:    ${CYAN}http://$SERVER_HOST:$backend_port${NC}"
    echo -e "     Database:   ${CYAN}$db_host:5432${NC}"
    echo -e "     Redis:      ${CYAN}:$redis_port${NC}"
    echo ""
    print_info "Don't forget to update the Fyers API credentials in $new_dir/.env"
}

menu_delete_instance() {
    print_section "🗑️ Delete Instance"
    
    local instances=($(get_all_instances))
    
    if [ ${#instances[@]} -le 1 ]; then
        print_warning "Cannot delete: You must keep at least one instance"
        return
    fi
    
    local instance
    instance=$(select_instance "all" "delete")
    local result=$?
    
    if [ $result -eq 2 ]; then
        print_info "Operation cancelled"
        return
    fi
    
    if [ $result -ne 0 ] || [ -z "$instance" ]; then
        return
    fi
    
    local num=$(get_instance_number "$instance")
    local instance_dir="$MULTI_INSTANCES_DIR/$instance"
    
    echo ""
    echo -e "  ${RED}${BOLD}⚠ WARNING: This will permanently delete Instance $num${NC}"
    echo -e "  ${RED}  Including all data, logs, and configurations!${NC}"
    echo ""
    echo -e "  ${CYAN}Type 'DELETE' to confirm:${NC} \c"
    read -r confirm
    
    if [ "$confirm" != "DELETE" ]; then
        print_info "Deletion cancelled"
        return
    fi
    
    # Stop if running
    if is_instance_running "$instance"; then
        print_loading "Stopping instance first..."
        stop_single_instance "$instance" true
        sleep 2
    fi
    
    # Remove volumes
    cd "$instance_dir"
    docker compose -f docker-compose.standalone.yml down -v >/dev/null 2>&1
    
    # Remove directory
    rm -rf "$instance_dir"
    
    print_success "Instance $num deleted permanently"
}

# Nuclear reset - wipe everything and start fresh
menu_nuclear_reset() {
    print_section "☢️  NUCLEAR RESET - Complete System Wipe"
    
    echo -e "  ${RED}${BOLD}⚠️  EXTREME WARNING ⚠️${NC}"
    echo ""
    echo -e "  ${RED}This will DESTROY EVERYTHING:${NC}"
    echo -e "  ${RED}  ✗ Stop all running containers${NC}"
    echo -e "  ${RED}  ✗ Delete all Docker images${NC}"
    echo -e "  ${RED}  ✗ Delete all Docker volumes${NC}"
    echo -e "  ${RED}  ✗ Delete all Docker build cache${NC}"
    echo -e "  ${RED}  ✗ Delete all instance data/logs/backups${NC}"
    echo -e "  ${RED}  ✗ Force complete rebuild from scratch${NC}"
    echo ""
    echo -e "  ${YELLOW}After reset, you'll need to:${NC}"
    echo -e "  ${YELLOW}  1. Regenerate .env files${NC}"
    echo -e "  ${YELLOW}  2. Rebuild all containers${NC}"
    echo -e "  ${YELLOW}  3. Restart instances${NC}"
    echo ""
    echo -e "  ${CYAN}This cannot be undone!${NC}"
    echo ""
    echo -e "  ${RED}${BOLD}Type 'NUKE' to confirm complete destruction:${NC} \c"
    read -r confirm
    
    if [ "$confirm" != "NUKE" ]; then
        print_info "Reset cancelled - your data is safe"
        return
    fi
    
    echo ""
    echo -e "  ${RED}${BOLD}FINAL WARNING: Type 'YES DELETE EVERYTHING' to proceed:${NC} \c"
    read -r final_confirm
    
    if [ "$final_confirm" != "YES DELETE EVERYTHING" ]; then
        print_info "Reset cancelled - your data is safe"
        return
    fi
    
    echo ""
    echo -e "  ${MAGENTA}${BOLD}Initiating nuclear reset sequence...${NC}"
    echo ""
    sleep 2
    
    # Step 1: Stop all running containers
    print_loading "Step 1/7: Stopping all containers..."
    local instances=($(get_all_instances))
    for instance in "${instances[@]}"; do
        local instance_dir="$MULTI_INSTANCES_DIR/$instance"
        cd "$instance_dir" 2>/dev/null
        docker compose -f docker-compose.standalone.yml down >/dev/null 2>&1
    done
    print_success "All containers stopped"
    sleep 1
    
    # Step 2: Remove all containers
    print_loading "Step 2/7: Removing all containers..."
    docker ps -aq --filter "label=com.daks.instance" | xargs -r docker rm -f >/dev/null 2>&1
    print_success "All containers removed"
    sleep 1
    
    # Step 3: Remove all images
    print_loading "Step 3/7: Removing all Docker images..."
    for instance in "${instances[@]}"; do
        docker rmi -f "${instance}-frontend" >/dev/null 2>&1
        docker rmi -f "${instance}-backend" >/dev/null 2>&1
        docker rmi -f "${instance}-fyers-5001" >/dev/null 2>&1
        docker rmi -f "${instance}-fyers-5010" >/dev/null 2>&1
    done
    print_success "All images removed"
    sleep 1
    
    # Step 4: Remove all volumes
    print_loading "Step 4/7: Removing all Docker volumes..."
    for instance in "${instances[@]}"; do
        local instance_dir="$MULTI_INSTANCES_DIR/$instance"
        cd "$instance_dir" 2>/dev/null
        docker compose -f docker-compose.standalone.yml down -v >/dev/null 2>&1
    done
    docker volume prune -f >/dev/null 2>&1
    print_success "All volumes removed"
    sleep 1
    
    # Step 5: Prune Docker system (cache, networks, etc.)
    print_loading "Step 5/7: Pruning Docker system cache..."
    docker system prune -af --volumes >/dev/null 2>&1
    docker builder prune -af >/dev/null 2>&1
    print_success "Docker cache cleared"
    sleep 1
    
    # Step 6: Clean instance directories
    print_loading "Step 6/7: Cleaning instance data directories..."
    for instance in "${instances[@]}"; do
        local instance_dir="$MULTI_INSTANCES_DIR/$instance"
        rm -rf "$instance_dir/data/"* 2>/dev/null
        rm -rf "$instance_dir/logs/"* 2>/dev/null
        rm -rf "$instance_dir/backups/"* 2>/dev/null
        mkdir -p "$instance_dir"/{data,logs,backups,config}
    done
    print_success "Instance directories cleaned"
    sleep 1
    
    # Step 7: Remove orphan containers
    print_loading "Step 7/7: Final cleanup..."
    docker container prune -f >/dev/null 2>&1
    docker network prune -f >/dev/null 2>&1
    print_success "Final cleanup complete"
    sleep 1
    
    echo ""
    echo -e "  ${GREEN}${BOLD}╔════════════════════════════════════════════════════════════╗${NC}"
    echo -e "  ${GREEN}${BOLD}║                  NUCLEAR RESET COMPLETE                    ║${NC}"
    echo -e "  ${GREEN}${BOLD}╚════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "  ${YELLOW}System is now in pristine state.${NC}"
    echo ""
    echo -e "  ${CYAN}Next steps:${NC}"
    echo -e "  ${CYAN}  1.${NC} Select DEV/PROD mode (will prompt on menu return)"
    echo -e "  ${CYAN}  2.${NC} Use option 16 to regenerate .env files"
    echo -e "  ${CYAN}  3.${NC} Use option 4 to start all instances"
    echo ""
    echo -e "  ${DIM}Docker cache cleared, all containers/images/volumes removed.${NC}"
    echo -e "  ${DIM}Next build will take longer but will be completely fresh.${NC}"
    echo ""
    
    # Force mode re-selection on return
    DEPLOY_MODE=""
}

# Quick reset - stop all, clear cache, restart
menu_quick_reset() {
    print_section "🔄 Quick Reset - Stop, Clear Cache, Ready to Rebuild"
    
    echo -e "  ${YELLOW}This will:${NC}"
    echo -e "  ${YELLOW}  • Stop all running instances${NC}"
    echo -e "  ${YELLOW}  • Clear Docker build cache${NC}"
    echo -e "  ${YELLOW}  • Preserve data/logs/backups${NC}"
    echo -e "  ${YELLOW}  • Keep .env files${NC}"
    echo ""
    echo -e "  ${CYAN}Continue? (y/N):${NC} \c"
    read -r confirm
    
    if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
        print_info "Reset cancelled"
        return
    fi
    
    echo ""
    
    # Stop all instances
    print_loading "Stopping all instances..."
    local instances=($(get_all_instances))
    for instance in "${instances[@]}"; do
        local instance_dir="$MULTI_INSTANCES_DIR/$instance"
        cd "$instance_dir" 2>/dev/null
        docker compose -f docker-compose.standalone.yml down >/dev/null 2>&1
    done
    print_success "All instances stopped"
    
    # Clear cache
    print_loading "Clearing Docker build cache..."
    docker builder prune -af >/dev/null 2>&1
    print_success "Cache cleared"
    
    # Prune unused resources
    print_loading "Removing unused containers and networks..."
    docker container prune -f >/dev/null 2>&1
    docker network prune -f >/dev/null 2>&1
    print_success "Cleanup complete"
    
    echo ""
    print_success "Quick reset complete!"
    echo ""
    echo -e "  ${CYAN}You can now rebuild and restart instances.${NC}"
}

# Regenerate .env files for all instances based on current DEPLOY_MODE
regenerate_all_env_files() {
    print_section "🔄 Regenerating Environment Files"
    
    echo -e "  ${BOLD}Current Mode:${NC} $DEPLOY_MODE"
    echo -e "  ${BOLD}Server Host:${NC} $SERVER_HOST"
    echo ""
    
    local instances=($(get_all_instances))
    
    if [ ${#instances[@]} -eq 0 ]; then
        print_warning "No instances found"
        return
    fi
    
    echo -e "  ${YELLOW}⚠ This will regenerate .env files for ${#instances[@]} instance(s)${NC}"
    echo -e "  ${YELLOW}  (Fyers API credentials will be preserved if present)${NC}"
    echo ""
    echo -e "  ${CYAN}Continue? (y/N):${NC} \c"
    read -r confirm
    
    if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
        print_info "Operation cancelled"
        return
    fi
    
    echo ""
    
    for instance in "${instances[@]}"; do
        local num=$(get_instance_number "$instance")
        local instance_dir="$MULTI_INSTANCES_DIR/$instance"
        
        # Read existing Fyers credentials if they exist
        local fyers_client_id="YOUR_FYERS_CLIENT_ID_HERE"
        local fyers_secret_id="YOUR_FYERS_SECRET_ID_HERE"
        local fyers_redirect_uri="https://raghavjaiswal709.github.io/DAKSphere_redirect"
        local fyers_access_token="YOUR_FYERS_ACCESS_TOKEN_HERE"
        
        if [ -f "$instance_dir/.env" ]; then
            local temp=$(grep "^FYERS_CLIENT_ID=" "$instance_dir/.env" 2>/dev/null | cut -d'=' -f2-)
            [ -n "$temp" ] && [ "$temp" != "YOUR_FYERS_CLIENT_ID_HERE" ] && fyers_client_id="$temp"
            
            temp=$(grep "^FYERS_SECRET_ID=" "$instance_dir/.env" 2>/dev/null | cut -d'=' -f2-)
            [ -n "$temp" ] && [ "$temp" != "YOUR_FYERS_SECRET_ID_HERE" ] && fyers_secret_id="$temp"
            
            temp=$(grep "^FYERS_REDIRECT_URI=" "$instance_dir/.env" 2>/dev/null | cut -d'=' -f2-)
            [ -n "$temp" ] && fyers_redirect_uri="$temp"
            
            temp=$(grep "^FYERS_ACCESS_TOKEN=" "$instance_dir/.env" 2>/dev/null | cut -d'=' -f2-)
            [ -n "$temp" ] && [ "$temp" != "YOUR_FYERS_ACCESS_TOKEN_HERE" ] && fyers_access_token="$temp"
        fi
        
        # Calculate ports
        local frontend_port=$((3000 + num))
        local backend_port=$((5100 + num))
        local base_fyers_5001=$((8001 + (num - 1) * 100))
        local base_fyers_5010=$((8010 + (num - 1) * 100))
        local redis_port=$((6380 + num))
        
        # DB_HOST always points to external PostgreSQL server
        # (Database is on server, not local machine)
        local db_host="100.93.172.21"
        
        print_loading "Regenerating Instance $num..."
        
        # Create .env file
        cat > "$instance_dir/.env" << EOF
# ═══════════════════════════════════════════════════════════════════════════
# DAKS TOP-K STOCKS - Instance $num Configuration
# Regenerated: $(date)
# Mode: $DEPLOY_MODE | Host: $SERVER_HOST
# ═══════════════════════════════════════════════════════════════════════════

# Instance Identification
INSTANCE_ID=$instance
INSTANCE_NAME="DAKS Instance $num"
INSTANCE_REGION=local

# Port Configuration
FRONTEND_PORT=$frontend_port
BACKEND_PORT=$backend_port
FYERS_5001_PORT=$base_fyers_5001
FYERS_5010_PORT=$base_fyers_5010
REDIS_PORT=$redis_port

# Database Configuration - EXTERNAL PostgreSQL
# In DEV mode: connects via host.docker.internal
# In PROD mode: connects directly to server IP
DB_HOST=$db_host
DB_PORT=5432
DB_USERNAME=readonly_user
DB_PASSWORD=db_read_5432
DB_DATABASE=nse_hist_db

# Redis Configuration - Internal Docker
REDIS_HOST=redis
REDIS_PORT_INTERNAL=6379
REDIS_URL=redis://redis:6379
REDIS_PASSWORD=

# Fyers API Configuration
FYERS_CLIENT_ID=$fyers_client_id
FYERS_SECRET_ID=$fyers_secret_id
FYERS_REDIRECT_URI=$fyers_redirect_uri
FYERS_ACCESS_TOKEN=$fyers_access_token

# Environment Configuration
NODE_ENV=development
PYTHONUNBUFFERED=1
PYTHONDONTWRITEBYTECODE=1
TZ=Asia/Kolkata

# Service URLs (Browser-accessible)
# In DEV: uses localhost so browser can reach the services
# In PROD: uses server IP
NEXT_PUBLIC_API_URL=http://$SERVER_HOST:$backend_port
NEXT_PUBLIC_WS_URL=ws://$SERVER_HOST:$backend_port
NEXT_PUBLIC_BACKEND_URL=http://$SERVER_HOST:$backend_port
NEXT_PUBLIC_GTT_API_URL=http://$SERVER_HOST:$backend_port
NEXT_PUBLIC_FYERS_SERVICE_5001_URL=http://$SERVER_HOST:$base_fyers_5001
NEXT_PUBLIC_FYERS_SERVICE_5010_URL=http://$SERVER_HOST:$base_fyers_5010
NEXT_PUBLIC_FYERS_SOCKET_URL=http://$SERVER_HOST:$base_fyers_5001
NEXT_PUBLIC_LIVE_MARKET_SOCKET_URL=http://$SERVER_HOST:$base_fyers_5010

# Internal Docker Service URLs
BACKEND_URL=http://backend:5002
FYERS_SERVICE_5001_URL=http://fyers-5001:5001
FYERS_SERVICE_5010_URL=http://fyers-5010:5010

# External API URLs
SIPR_API_URL=http://$SERVER_HOST:8510
PREDICTION_API_URL=http://$SERVER_HOST:5112
PREMARKET_API_URL=http://$SERVER_HOST:5717

# Logging
LOG_LEVEL=debug
LOG_DIR=/app/logs

# Performance
MAX_CONNECTIONS=100
REDIS_MAX_MEMORY=512mb
WORKER_THREADS=4

# User Information
NEXT_PUBLIC_INSTANCE_USER_NAME="Instance $num User"
NEXT_PUBLIC_INSTANCE_USER_EMAIL="user$num@daks.com"
EOF
        print_success "Instance $num regenerated"
    done
    
    echo ""
    print_success "All .env files regenerated for ${BOLD}$DEPLOY_MODE${NC} mode"
    echo ""
    print_warning "You need to REBUILD running instances for changes to take effect!"
    echo -e "  ${CYAN}Run option 17 (Rebuild Instances) from the main menu${NC}"
}

# Rebuild frontend for instance(s) with new env vars
rebuild_instances() {
    print_section "🔨 Rebuild Instance Frontend"
    
    echo -e "  ${BOLD}${WHITE}Select rebuild scope:${NC}"
    echo ""
    echo -e "  ${YELLOW}1)${NC} Rebuild specific instance"
    echo -e "  ${YELLOW}2)${NC} Rebuild ALL instances"
    echo -e "  ${YELLOW}3)${NC} Cancel"
    echo ""
    echo -n "  Select option (1-3): "
    read -r rebuild_choice
    
    case "$rebuild_choice" in
        1)
            # Select instance
            local instance
            instance=$(select_instance "all" "rebuild")
            local result=$?
            
            if [ $result -eq 2 ]; then
                print_info "Operation cancelled"
                return
            fi
            
            if [ $result -ne 0 ] || [ -z "$instance" ]; then
                print_error "Invalid selection"
                return
            fi
            
            local num=$(get_instance_number "$instance")
            local instance_dir="$MULTI_INSTANCES_DIR/$instance"
            
            echo ""
            echo -e "  ${YELLOW}⚠ This will rebuild the frontend for Instance $num${NC}"
            echo -e "  ${YELLOW}  The container will be temporarily unavailable${NC}"
            echo ""
            echo -e "  ${CYAN}Continue? (y/N):${NC} \c"
            read -r confirm
            
            if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
                print_info "Operation cancelled"
                return
            fi
            
            echo ""
            print_loading "Rebuilding Instance $num frontend..."
            
            cd "$instance_dir"
            if docker compose -f docker-compose.standalone.yml build --no-cache frontend >/dev/null 2>&1; then
                print_success "Frontend rebuilt successfully"
                echo ""
                print_loading "Restarting frontend..."
                if docker compose -f docker-compose.standalone.yml up -d frontend >/dev/null 2>&1; then
                    print_success "Instance $num frontend restarted"
                else
                    print_error "Failed to restart frontend"
                fi
            else
                print_error "Failed to rebuild frontend"
            fi
            ;;
            
        2)
            # Rebuild all instances
            local instances=($(get_all_instances))
            
            if [ ${#instances[@]} -eq 0 ]; then
                print_warning "No instances found"
                return
            fi
            
            echo ""
            echo -e "  ${YELLOW}⚠ This will rebuild frontends for ${#instances[@]} instance(s)${NC}"
            echo -e "  ${YELLOW}  This may take several minutes${NC}"
            echo ""
            echo -e "  ${CYAN}Continue? (y/N):${NC} \c"
            read -r confirm
            
            if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
                print_info "Operation cancelled"
                return
            fi
            
            echo ""
            local rebuilt=0
            local failed=0
            
            for instance in "${instances[@]}"; do
                local num=$(get_instance_number "$instance")
                local instance_dir="$MULTI_INSTANCES_DIR/$instance"
                
                print_loading "Rebuilding Instance $num frontend..."
                
                cd "$instance_dir"
                if docker compose -f docker-compose.standalone.yml build --no-cache frontend >/dev/null 2>&1; then
                    if docker compose -f docker-compose.standalone.yml up -d frontend >/dev/null 2>&1; then
                        print_success "Instance $num rebuilt and restarted"
                        ((rebuilt++))
                    else
                        print_error "Instance $num rebuild succeeded but restart failed"
                        ((failed++))
                    fi
                else
                    print_error "Instance $num rebuild failed"
                    ((failed++))
                fi
            done
            
            echo ""
            echo -e "  ${BOLD}Summary:${NC} ${GREEN}$rebuilt rebuilt${NC} │ ${RED}$failed failed${NC}"
            ;;
            
        *)
            print_info "Operation cancelled"
            ;;
    esac
}

menu_switch_mode() {
    print_section "🔄 Switch DEV/PROD Mode"
    
    local current_mode="$DEPLOY_MODE"
    
    echo -e "  ${BOLD}Current Mode:${NC} $DEPLOY_MODE ($SERVER_HOST)"
    echo ""
    
    select_deploy_mode
    
    if [ "$DEPLOY_MODE" != "$current_mode" ]; then
        echo ""
        echo -e "  ${YELLOW}Mode changed from ${NC}${BOLD}$current_mode${NC}${YELLOW} to ${NC}${BOLD}$DEPLOY_MODE${NC}"
        echo ""
        echo -e "  ${CYAN}Regenerate .env files for all instances? (y/N):${NC} \c"
        read -r regen
        
        if [[ "$regen" =~ ^[Yy]$ ]]; then
            regenerate_all_env_files
        else
            print_info "Mode changed. Run 'Regenerate Env Files' from menu to update instances."
        fi
    fi
}

# ═══════════════════════════════════════════════════════════════════════════════
# MAIN MENU
# ═══════════════════════════════════════════════════════════════════════════════

show_main_menu() {
    print_banner
    show_status_summary
    echo ""
    
    local mode_indicator=""
    if [ "$DEPLOY_MODE" = "dev" ]; then
        mode_indicator="${GREEN}[DEV]${NC}"
    else
        mode_indicator="${MAGENTA}[PROD]${NC}"
    fi
    
    echo -e "${CYAN}┌──────────────────────────────────────────────────────────────────────────────┐${NC}"
    echo -e "${CYAN}│${NC}  ${BOLD}${WHITE}MAIN MENU${NC} $mode_indicator                                                       ${CYAN}│${NC}"
    echo -e "${CYAN}├──────────────────────────────────────────────────────────────────────────────┤${NC}"
    echo -e "${CYAN}│${NC}                                                                              ${CYAN}│${NC}"
    echo -e "${CYAN}│${NC}   ${BOLD}INSTANCE CONTROL${NC}                         ${BOLD}MONITORING & LOGS${NC}                ${CYAN}│${NC}"
    echo -e "${CYAN}│${NC}   ${YELLOW} 1)${NC} ${GREEN}▶${NC}  Start Instance                ${YELLOW} 7)${NC} 📊 View Status                  ${CYAN}│${NC}"
    echo -e "${CYAN}│${NC}   ${YELLOW} 2)${NC} ${RED}■${NC}  Stop Instance                 ${YELLOW} 8)${NC} 📋 View Logs                    ${CYAN}│${NC}"
    echo -e "${CYAN}│${NC}   ${YELLOW} 3)${NC} 🔄 Restart Instance              ${YELLOW} 9)${NC} 🏥 Health Check                 ${CYAN}│${NC}"
    echo -e "${CYAN}│${NC}   ${YELLOW} 4)${NC} ${GREEN}▶▶${NC} Start All                     ${YELLOW}10)${NC} 📈 Resource Usage               ${CYAN}│${NC}"
    echo -e "${CYAN}│${NC}   ${YELLOW} 5)${NC} ${RED}■■${NC} Stop All                                                          ${CYAN}│${NC}"
    echo -e "${CYAN}│${NC}   ${YELLOW} 6)${NC} 🔄 Restart All                   ${BOLD}MANAGEMENT${NC}                         ${CYAN}│${NC}"
    echo -e "${CYAN}│${NC}                                         ${YELLOW}11)${NC} 🗄  Database Operations         ${CYAN}│${NC}"
    echo -e "${CYAN}│${NC}   ${BOLD}INSTANCE MANAGEMENT${NC}                     ${YELLOW}12)${NC} 🖥  Open Shell                  ${CYAN}│${NC}"
    echo -e "${CYAN}│${NC}   ${YELLOW}13)${NC} ➕ Create New Instance            ${YELLOW}14)${NC} 🗑  Delete Instance             ${CYAN}│${NC}"
    echo -e "${CYAN}│${NC}                                                                              ${CYAN}│${NC}"
    echo -e "${CYAN}│${NC}   ${BOLD}CONFIGURATION${NC}                                                              ${CYAN}│${NC}"
    echo -e "${CYAN}│${NC}   ${YELLOW}15)${NC} 🔧 Switch DEV/PROD Mode          ${YELLOW}16)${NC} 📝 Regenerate Env Files        ${CYAN}│${NC}"
    echo -e "${CYAN}│${NC}   ${YELLOW}17)${NC} 🔨 Rebuild Instances                                                 ${CYAN}│${NC}"
    echo -e "${CYAN}│${NC}                                                                              ${CYAN}│${NC}"
    echo -e "${CYAN}│${NC}   ${BOLD}RESET & RECOVERY${NC}                                                           ${CYAN}│${NC}"
    echo -e "${CYAN}│${NC}   ${YELLOW}18)${NC} 🔄 Quick Reset (Cache Only)      ${YELLOW}19)${NC} ☢️  Nuclear Reset (DANGER!)     ${CYAN}│${NC}"
    echo -e "${CYAN}│${NC}                                                                              ${CYAN}│${NC}"
    echo -e "${CYAN}│${NC}   ${YELLOW} 0)${NC} ${DIM}Exit${NC}                              ${YELLOW} h)${NC} ${DIM}Help (CLI Commands)${NC}            ${CYAN}│${NC}"
    echo -e "${CYAN}│${NC}                                                                              ${CYAN}│${NC}"
    echo -e "${CYAN}└──────────────────────────────────────────────────────────────────────────────┘${NC}"
    echo ""
    echo -e "  ${CYAN}Enter choice:${NC} \c"
}

show_cli_help() {
    print_section "📖 CLI Commands Reference"
    
    echo -e "  ${BOLD}You can also use this script from command line:${NC}"
    echo ""
    echo -e "  ${CYAN}Mode Selection:${NC}"
    echo -e "     ${DIM}Current Mode:${NC} ${GREEN}$DEPLOY_MODE${NC} (${SERVER_HOST})"
    echo -e "     ./manager.sh --dev <command>    ${DIM}Run in DEV mode (localhost)${NC}"
    echo -e "     ./manager.sh --prod <command>   ${DIM}Run in PROD mode (server IP)${NC}"
    echo ""
    echo -e "  ${CYAN}Lifecycle:${NC}"
    echo -e "     ./manager.sh start-all          ${DIM}Start all instances${NC}"
    echo -e "     ./manager.sh stop-all           ${DIM}Stop all instances${NC}"
    echo -e "     ./manager.sh restart-all        ${DIM}Restart all instances${NC}"
    echo -e "     ./manager.sh start <num>        ${DIM}Start specific instance${NC}"
    echo -e "     ./manager.sh stop <num>         ${DIM}Stop specific instance${NC}"
    echo ""
    echo -e "  ${CYAN}Monitoring:${NC}"
    echo -e "     ./manager.sh status             ${DIM}Show all instance status${NC}"
    echo -e "     ./manager.sh health-check       ${DIM}Run health checks${NC}"
    echo -e "     ./manager.sh logs <num>         ${DIM}View instance logs${NC}"
    echo -e "     ./manager.sh resources          ${DIM}Show resource usage${NC}"
    echo ""
    echo -e "  ${CYAN}Configuration:${NC}"
    echo -e "     ./manager.sh regen-env          ${DIM}Regenerate all .env files${NC}"
    echo -e "     ./manager.sh rebuild <num>      ${DIM}Rebuild specific instance frontend${NC}"
    echo -e "     ./manager.sh rebuild-all        ${DIM}Rebuild all instances frontends${NC}"
    echo ""
    echo -e "  ${CYAN}Reset & Recovery:${NC}"
    echo -e "     ./manager.sh quick-reset        ${DIM}Stop all & clear cache${NC}"
    echo -e "     ./manager.sh nuclear-reset      ${DIM}Complete system wipe (DANGER!)${NC}"
    echo ""
    echo -e "  ${CYAN}Database:${NC}"
    echo -e "     ./manager.sh db-shell <num>     ${DIM}Open psql shell${NC}"
    echo -e "     ./manager.sh db-backup <num>    ${DIM}Backup database${NC}"
    echo ""
    echo -e "  ${CYAN}Examples:${NC}"
    echo -e "     ${DIM}# Start instance 2 in dev mode${NC}"
    echo -e "     ./manager.sh --dev start 2"
    echo -e ""
    echo -e "     ${DIM}# Regenerate env files for production${NC}"
    echo -e "     ./manager.sh --prod regen-env"
}

# ═══════════════════════════════════════════════════════════════════════════════
# CLI COMMAND HANDLER
# ═══════════════════════════════════════════════════════════════════════════════

handle_cli_command() {
    local command=$1
    local arg1=$2
    local arg2=$3
    
    # Handle --dev and --prod flags
    if [ "$command" = "--dev" ] || [ "$command" = "-d" ]; then
        DEPLOY_MODE="dev"
        SERVER_HOST="localhost"
        command=$arg1
        arg1=$arg2
        arg2=$3
    elif [ "$command" = "--prod" ] || [ "$command" = "-p" ]; then
        DEPLOY_MODE="prod"
        SERVER_HOST="100.93.172.21"
        command=$arg1
        arg1=$arg2
        arg2=$3
    fi
    
    case "$command" in
        start-all)
            start_all_instances
            ;;
        stop-all)
            stop_all_instances
            ;;
        restart-all)
            restart_all_instances
            ;;
        start)
            if [ -z "$arg1" ]; then
                print_error "Usage: $0 start <instance_number>"
                exit 1
            fi
            start_single_instance "instance$arg1"
            ;;
        stop)
            if [ -z "$arg1" ]; then
                print_error "Usage: $0 stop <instance_number>"
                exit 1
            fi
            stop_single_instance "instance$arg1"
            ;;
        restart)
            if [ -z "$arg1" ]; then
                print_error "Usage: $0 restart <instance_number>"
                exit 1
            fi
            restart_single_instance "instance$arg1"
            ;;
        status)
            show_detailed_status
            ;;
        logs)
            if [ -z "$arg1" ]; then
                print_error "Usage: $0 logs <instance_number> [service]"
                exit 1
            fi
            local instance_dir="$MULTI_INSTANCES_DIR/instance$arg1"
            cd "$instance_dir"
            if [ -z "$arg2" ]; then
                docker compose -f docker-compose.standalone.yml logs -f --tail=100
            else
                docker compose -f docker-compose.standalone.yml logs -f --tail=100 "$arg2"
            fi
            ;;
        health-check|health)
            menu_health_check
            ;;
        resources)
            menu_resource_usage
            ;;
        regen-env|regenerate)
            regenerate_all_env_files
            ;;
        rebuild)
            if [ -z "$arg1" ]; then
                print_error "Usage: $0 rebuild <instance_number>"
                exit 1
            fi
            local instance_dir="$MULTI_INSTANCES_DIR/instance$arg1"
            if [ ! -d "$instance_dir" ]; then
                print_error "Instance $arg1 not found"
                exit 1
            fi
            print_loading "Rebuilding instance $arg1 frontend..."
            cd "$instance_dir"
            docker compose -f docker-compose.standalone.yml build --no-cache frontend
            docker compose -f docker-compose.standalone.yml up -d frontend
            print_success "Instance $arg1 rebuilt"
            ;;
        rebuild-all)
            local instances=($(get_all_instances))
            for instance in "${instances[@]}"; do
                local num=$(get_instance_number "$instance")
                local instance_dir="$MULTI_INSTANCES_DIR/$instance"
                print_loading "Rebuilding instance $num frontend..."
                cd "$instance_dir"
                docker compose -f docker-compose.standalone.yml build --no-cache frontend >/dev/null 2>&1
                docker compose -f docker-compose.standalone.yml up -d frontend >/dev/null 2>&1
                print_success "Instance $num rebuilt"
            done
            ;;
        quick-reset)
            menu_quick_reset
            ;;
        nuclear-reset|nuke)
            menu_nuclear_reset
            ;;
        db-shell)
            if [ -z "$arg1" ]; then
                print_error "Usage: $0 db-shell <instance_number>"
                exit 1
            fi
            local instance_dir="$MULTI_INSTANCES_DIR/instance$arg1"
            cd "$instance_dir"
            source .env
            docker compose -f docker-compose.standalone.yml exec db psql -U $POSTGRES_USER -d $POSTGRES_DB
            ;;
        db-backup)
            if [ -z "$arg1" ]; then
                print_error "Usage: $0 db-backup <instance_number>"
                exit 1
            fi
            local instance_dir="$MULTI_INSTANCES_DIR/instance$arg1"
            cd "$instance_dir"
            source .env
            mkdir -p "$instance_dir/backups"
            local backup_file="$instance_dir/backups/backup_$(date +%Y%m%d_%H%M%S).sql"
            docker compose -f docker-compose.standalone.yml exec -T db pg_dump -U $POSTGRES_USER $POSTGRES_DB > "$backup_file"
            print_success "Backup created: $backup_file"
            ;;
        help|-h|--help)
            show_cli_help
            ;;
        *)
            print_error "Unknown command: $command"
            echo "Use: $0 help"
            exit 1
            ;;
    esac
}

# ═══════════════════════════════════════════════════════════════════════════════
# MAIN LOOP
# ═══════════════════════════════════════════════════════════════════════════════

main_interactive() {
    # Create log directory
    mkdir -p "$LOG_DIR"
    
    # First, select DEV or PROD mode
    select_deploy_mode
    
    # Check and repair any broken instances
    check_and_repair_instances
    
    while true; do
        show_main_menu
        read -r choice
        
        case "$choice" in
            1)
                menu_start_instance
                press_enter
                ;;
            2)
                menu_stop_instance
                press_enter
                ;;
            3)
                menu_restart_instance
                press_enter
                ;;
            4)
                start_all_instances
                press_enter
                ;;
            5)
                stop_all_instances
                press_enter
                ;;
            6)
                restart_all_instances
                press_enter
                ;;
            7)
                show_detailed_status
                press_enter
                ;;
            8)
                menu_view_logs
                ;;
            9)
                menu_health_check
                press_enter
                ;;
            10)
                menu_resource_usage
                press_enter
                ;;
            11)
                menu_db_operations
                press_enter
                ;;
            12)
                menu_open_shell
                press_enter
                ;;
            13)
                menu_create_instance
                press_enter
                ;;
            14)
                menu_delete_instance
                press_enter
                ;;
            15)
                menu_switch_mode
                press_enter
                ;;
            16)
                regenerate_all_env_files
                press_enter
                ;;
            17)
                rebuild_instances
                press_enter
                ;;
            18)
                menu_quick_reset
                press_enter
                ;;
            19)
                menu_nuclear_reset
                press_enter
                ;;
            h|H|help)
                show_cli_help
                press_enter
                ;;
            0|q|Q|exit|Exit|EXIT)
                echo ""
                echo -e "  ${GREEN}${BOLD}👋 Goodbye! Thanks for using DAKS Instance Manager.${NC}"
                echo ""
                exit 0
                ;;
            *)
                print_error "Invalid choice. Please enter 0-19, h for help, or q to quit."
                sleep 1
                ;;
        esac
    done
}

# ═══════════════════════════════════════════════════════════════════════════════
# ENTRY POINT
# ═══════════════════════════════════════════════════════════════════════════════

# Handle Ctrl+C gracefully
trap 'echo ""; print_info "Returning to menu..."; sleep 0.3' INT

# Check if we have CLI arguments
if [ $# -gt 0 ]; then
    # For CLI commands, default to dev mode unless specified
    if [ -z "$DEPLOY_MODE" ]; then
        DEPLOY_MODE="dev"
        SERVER_HOST="localhost"
    fi
    handle_cli_command "$@"
else
    main_interactive
fi

exit 0
