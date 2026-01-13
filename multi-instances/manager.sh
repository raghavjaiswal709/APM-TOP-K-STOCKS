#!/bin/bash

################################################################################
# DAKS TOP-K STOCKS - Multi-Instance Manager
# Complete orchestration with Interactive Menu
# Version: 2.0
# Date: December 22, 2025
################################################################################

# CONFIGURATION

PROJECT_DIR="/Users/raghav/Documents/GitHub/APM-TOP-K-STOCKS"
MULTI_INSTANCES_DIR="$PROJECT_DIR/multi-instances"
LOG_DIR="$MULTI_INSTANCES_DIR/logs"

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
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BOLD}${WHITE}  🚀 MULTI-INSTANCE MANAGER v2.0${NC}"
    echo -e "${DIM}  Docker Orchestration Made Easy${NC}"
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
                has_running=true
            fi
            local num=$(get_instance_number "$instance")
            local frontend_port=$(get_instance_config "$instance" "FRONTEND_PORT")
            local backend_port=$(get_instance_config "$instance" "BACKEND_PORT")
            echo -e "     ${CYAN}Instance $num:${NC} http://localhost:$frontend_port ${DIM}(API: :$backend_port)${NC}"
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
            echo -e "     ${DIM}Frontend: http://localhost:$frontend_port${NC}"
            echo -e "     ${DIM}Backend:  http://localhost:$backend_port${NC}"
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
        echo -e "  ${BOLD}${WHITE}🔗 Access URLs:${NC}"
        for instance in "${instances[@]}"; do
            if is_instance_running "$instance"; then
                local num=$(get_instance_number "$instance")
                local port=$(get_instance_config "$instance" "FRONTEND_PORT")
                echo -e "     ${CYAN}Instance $num:${NC} http://localhost:$port"
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
        if curl -s --connect-timeout 2 "http://localhost:$FRONTEND_PORT" >/dev/null 2>&1; then
            print_success "Frontend (:$FRONTEND_PORT)"
            ((passed_checks++))
        else
            print_error "Frontend (:$FRONTEND_PORT)"
        fi
        
        # Backend check
        ((total_checks++))
        if curl -s --connect-timeout 2 "http://localhost:$BACKEND_PORT/health" >/dev/null 2>&1 || \
           curl -s --connect-timeout 2 "http://localhost:$BACKEND_PORT" >/dev/null 2>&1; then
            print_success "Backend (:$BACKEND_PORT)"
            ((passed_checks++))
        else
            print_error "Backend (:$BACKEND_PORT)"
        fi
        
        # Database check
        ((total_checks++))
        if nc -z localhost $POSTGRES_PORT >/dev/null 2>&1; then
            print_success "Database (:$POSTGRES_PORT)"
            ((passed_checks++))
        else
            print_error "Database (:$POSTGRES_PORT)"
        fi
        
        # Redis check
        ((total_checks++))
        if nc -z localhost $REDIS_PORT >/dev/null 2>&1; then
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
    
    echo -e "  Creating ${CYAN}Instance $new_num${NC}"
    echo ""
    
    # Calculate default ports based on instance number
    local base_frontend=$((3000 + (new_num - 1) * 100))
    local base_backend=$((5002 + (new_num - 1) * 100))
    local base_fyers_5001=$((8001 + (new_num - 1) * 100))
    local base_fyers_5010=$((8010 + (new_num - 1) * 100))
    local base_postgres=$((5432 + (new_num - 1) * 10))
    local base_redis=$((6379 + (new_num - 1) * 10))
    
    echo -e "  ${CYAN}Frontend Port ${DIM}(default: $base_frontend)${NC}: \c"
    read -r frontend_port
    frontend_port=${frontend_port:-$base_frontend}
    
    echo -e "  ${CYAN}Backend Port ${DIM}(default: $base_backend)${NC}: \c"
    read -r backend_port
    backend_port=${backend_port:-$base_backend}
    
    echo -e "  ${CYAN}PostgreSQL Port ${DIM}(default: $base_postgres)${NC}: \c"
    read -r postgres_port
    postgres_port=${postgres_port:-$base_postgres}
    
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
    
    # Create .env file
    cat > "$new_dir/.env" << EOF
# ═══════════════════════════════════════════════════════════════════════════
# DAKS TOP-K STOCKS - Instance $new_num Configuration
# Created: $(date)
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
POSTGRES_PORT=$postgres_port
REDIS_PORT=$redis_port

# Database Configuration
POSTGRES_USER=postgres
POSTGRES_PASSWORD=daks_secure_password_2025
POSTGRES_DB=daks_stocks_$new_instance
DATABASE_URL=postgresql://postgres:daks_secure_password_2025@db:5432/daks_stocks_$new_instance

# Redis Configuration
REDIS_URL=redis://redis:6379
REDIS_PASSWORD=

# Fyers API Configuration
FYERS_CLIENT_ID=YOUR_FYERS_CLIENT_ID_HERE
FYERS_SECRET_ID=YOUR_FYERS_SECRET_ID_HERE
FYERS_REDIRECT_URI=http://localhost:$frontend_port/auth/callback
FYERS_ACCESS_TOKEN=YOUR_FYERS_ACCESS_TOKEN_HERE

# Environment Configuration
NODE_ENV=development
PYTHONUNBUFFERED=1
PYTHONDONTWRITEBYTECODE=1
TZ=Asia/Kolkata

# Service URLs
NEXT_PUBLIC_API_URL=http://localhost:$backend_port
BACKEND_URL=http://backend:$backend_port
FYERS_SERVICE_5001_URL=http://localhost:$base_fyers_5001
FYERS_SERVICE_5010_URL=http://localhost:$base_fyers_5010

# Logging
LOG_LEVEL=debug
LOG_DIR=/app/logs

# Performance
MAX_CONNECTIONS=100
REDIS_MAX_MEMORY=512mb
WORKER_THREADS=4
EOF
    
    print_success "Instance $new_num created successfully!"
    echo ""
    echo -e "  ${BOLD}Configuration:${NC}"
    echo -e "     Directory:  ${DIM}$new_dir${NC}"
    echo -e "     Frontend:   ${CYAN}:$frontend_port${NC}"
    echo -e "     Backend:    ${CYAN}:$backend_port${NC}"
    echo -e "     PostgreSQL: ${CYAN}:$postgres_port${NC}"
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

# ═══════════════════════════════════════════════════════════════════════════════
# MAIN MENU
# ═══════════════════════════════════════════════════════════════════════════════

show_main_menu() {
    print_banner
    show_status_summary
    echo ""
    
    echo -e "${CYAN}┌──────────────────────────────────────────────────────────────────────────────┐${NC}"
    echo -e "${CYAN}│${NC}  ${BOLD}${WHITE}MAIN MENU${NC}                                                                  ${CYAN}│${NC}"
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
    echo -e "  ${CYAN}Database:${NC}"
    echo -e "     ./manager.sh db-shell <num>     ${DIM}Open psql shell${NC}"
    echo -e "     ./manager.sh db-backup <num>    ${DIM}Backup database${NC}"
}

# ═══════════════════════════════════════════════════════════════════════════════
# CLI COMMAND HANDLER
# ═══════════════════════════════════════════════════════════════════════════════

handle_cli_command() {
    local command=$1
    local arg1=$2
    local arg2=$3
    
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
                print_error "Invalid choice. Please enter 0-14, h for help, or q to quit."
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
    handle_cli_command "$@"
else
    main_interactive
fi

exit 0
