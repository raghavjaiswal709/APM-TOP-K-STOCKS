#!/usr/bin/env bash

################################################################################
# DAKS TOP-K STOCKS - Multi-Instance Manager
# A user-friendly script to manage all instances (start, stop, logs, etc.)
# No Docker/developer knowledge required
################################################################################

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Directories
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INSTANCES_DIR="$REPO_ROOT/multi-instances"
LOG_DIR="$INSTANCES_DIR/logs"

# Ensure log directory exists
mkdir -p "$LOG_DIR"

################################################################################
# HELPER FUNCTIONS
################################################################################

print_header() {
    echo -e "\n${CYAN}════════════════════════════════════════════════════════${NC}"
    echo -e "${CYAN}  DAKS TOP-K STOCKS - Multi-Instance Manager${NC}"
    echo -e "${CYAN}════════════════════════════════════════════════════════${NC}\n"
}

print_menu() {
    echo -e "${BLUE}What would you like to do?${NC}\n"
    echo "  1) Start an instance"
    echo "  2) Stop an instance"
    echo "  3) Restart an instance"
    echo "  4) Start all instances"
    echo "  5) Stop all instances"
    echo "  6) Restart all instances"
    echo "  7) View logs for an instance"
    echo "  8) View logs for all instances"
    echo "  9) Check status of all instances"
    echo " 10) Check status of specific instance"
    echo " 11) Remove/Clean up an instance"
    echo " 12) Remove/Clean up all instances"
    echo " 13) View instance details"
    echo "  0) Exit"
    echo ""
}

get_instance_list() {
    local instances=()
    if [[ -d "$INSTANCES_DIR" ]]; then
        for dir in "$INSTANCES_DIR"/instance*/; do
            if [[ -d "$dir" ]]; then
                instances+=("$(basename "$dir")")
            fi
        done
    fi
    printf '%s\n' "${instances[@]}" | sort -V
}

validate_instance() {
    local instance="$1"
    if [[ ! -d "$INSTANCES_DIR/$instance" ]]; then
        echo -e "${RED}✗ Instance '$instance' not found.${NC}"
        return 1
    fi
    if [[ ! -f "$INSTANCES_DIR/$instance/.env" ]]; then
        echo -e "${RED}✗ .env file not found for '$instance'.${NC}"
        return 1
    fi
    return 0
}

select_instance() {
    local prompt="$1"
    local instances
    mapfile -t instances < <(get_instance_list)
    
    if [[ ${#instances[@]} -eq 0 ]]; then
        echo -e "${RED}✗ No instances found in $INSTANCES_DIR${NC}"
        return 1
    fi
    
    echo -e "\n${BLUE}$prompt${NC}"
    for i in "${!instances[@]}"; do
        echo "  $((i + 1))) ${instances[$i]}"
    done
    echo ""
    
    read -p "Enter choice (1-${#instances[@]}): " choice
    
    if [[ ! "$choice" =~ ^[0-9]+$ ]] || [[ $choice -lt 1 ]] || [[ $choice -gt ${#instances[@]} ]]; then
        echo -e "${RED}✗ Invalid choice.${NC}"
        return 1
    fi
    
    echo "${instances[$((choice - 1))]}"
}

################################################################################
# DOCKER OPERATIONS
################################################################################

start_instance() {
    local instance="$1"
    
    if ! validate_instance "$instance"; then
        return 1
    fi
    
    local env_file="$INSTANCES_DIR/$instance/.env"
    local project="daks-$instance"
    
    echo -e "${YELLOW}⏳ Starting $instance...${NC}"
    
    if docker compose --env-file "$env_file" -p "$project" up -d >> "$LOG_DIR/$instance.start.log" 2>&1; then
        echo -e "${GREEN}✓ $instance started successfully.${NC}"
        sleep 2
        show_container_status "$project"
        return 0
    else
        echo -e "${RED}✗ Failed to start $instance. Check logs:${NC}"
        tail -n 10 "$LOG_DIR/$instance.start.log"
        return 1
    fi
}

stop_instance() {
    local instance="$1"
    
    if ! validate_instance "$instance"; then
        return 1
    fi
    
    local project="daks-$instance"
    
    echo -e "${YELLOW}⏳ Stopping $instance...${NC}"
    
    if docker compose -p "$project" down >> "$LOG_DIR/$instance.stop.log" 2>&1; then
        echo -e "${GREEN}✓ $instance stopped successfully.${NC}"
        return 0
    else
        echo -e "${RED}✗ Failed to stop $instance.${NC}"
        return 1
    fi
}

restart_instance() {
    local instance="$1"
    
    stop_instance "$instance" || true
    sleep 2
    start_instance "$instance"
}

check_instance_status() {
    local instance="$1"
    
    if ! validate_instance "$instance"; then
        return 1
    fi
    
    local project="daks-$instance"
    
    echo -e "\n${BLUE}Status of $instance:${NC}\n"
    show_container_status "$project"
}

show_container_status() {
    local project="$1"
    
    if docker compose -p "$project" ps 2>/dev/null | grep -q "Up"; then
        docker compose -p "$project" ps
        echo -e "\n${GREEN}✓ Instance is running${NC}"
    else
        docker compose -p "$project" ps 2>/dev/null || echo -e "${YELLOW}⚠ No containers found for $project${NC}"
        echo -e "\n${RED}✗ Instance is not running${NC}"
    fi
}

show_all_status() {
    echo -e "\n${BLUE}Status of all instances:${NC}\n"
    
    local instances
    mapfile -t instances < <(get_instance_list)
    
    if [[ ${#instances[@]} -eq 0 ]]; then
        echo -e "${RED}✗ No instances found.${NC}"
        return 1
    fi
    
    for instance in "${instances[@]}"; do
        local project="daks-$instance"
        echo -e "${CYAN}━━━ $instance ━━━${NC}"
        
        if docker compose -p "$project" ps 2>/dev/null | grep -q "Up"; then
            echo -e "${GREEN}✓ Running${NC}"
            docker compose -p "$project" ps --no-trunc 2>/dev/null | tail -n +2 | awk '{printf "  %s\n", $0}'
        else
            echo -e "${RED}✗ Stopped${NC}"
        fi
        echo ""
    done
}

remove_instance() {
    local instance="$1"
    
    if ! validate_instance "$instance"; then
        return 1
    fi
    
    local project="daks-$instance"
    
    echo -e "${YELLOW}⚠️  This will stop and remove all containers and volumes for $instance.${NC}"
    read -p "Are you sure? Type '$instance' to confirm: " confirm
    
    if [[ "$confirm" != "$instance" ]]; then
        echo -e "${YELLOW}Cancelled.${NC}"
        return 0
    fi
    
    echo -e "${YELLOW}⏳ Removing $instance...${NC}"
    
    if docker compose -p "$project" down -v >> "$LOG_DIR/$instance.remove.log" 2>&1; then
        echo -e "${GREEN}✓ $instance removed successfully.${NC}"
        return 0
    else
        echo -e "${RED}✗ Failed to remove $instance.${NC}"
        return 1
    fi
}

################################################################################
# BULK OPERATIONS
################################################################################

start_all_instances() {
    local instances
    mapfile -t instances < <(get_instance_list)
    
    if [[ ${#instances[@]} -eq 0 ]]; then
        echo -e "${RED}✗ No instances found.${NC}"
        return 1
    fi
    
    echo -e "${YELLOW}⏳ Starting all instances...${NC}\n"
    
    for instance in "${instances[@]}"; do
        start_instance "$instance"
        echo ""
    done
    
    echo -e "${GREEN}✓ All instances started.${NC}"
}

stop_all_instances() {
    local instances
    mapfile -t instances < <(get_instance_list)
    
    if [[ ${#instances[@]} -eq 0 ]]; then
        echo -e "${RED}✗ No instances found.${NC}"
        return 1
    fi
    
    echo -e "${YELLOW}⏳ Stopping all instances...${NC}\n"
    
    for instance in "${instances[@]}"; do
        stop_instance "$instance"
        echo ""
    done
    
    echo -e "${GREEN}✓ All instances stopped.${NC}"
}

restart_all_instances() {
    echo -e "${YELLOW}⏳ Restarting all instances...${NC}\n"
    stop_all_instances
    sleep 3
    start_all_instances
}

remove_all_instances() {
    local instances
    mapfile -t instances < <(get_instance_list)
    
    if [[ ${#instances[@]} -eq 0 ]]; then
        echo -e "${RED}✗ No instances found.${NC}"
        return 1
    fi
    
    echo -e "${YELLOW}⚠️  This will stop and remove ALL instances and their data.${NC}"
    read -p "Type 'yes' to confirm: " confirm
    
    if [[ "$confirm" != "yes" ]]; then
        echo -e "${YELLOW}Cancelled.${NC}"
        return 0
    fi
    
    echo -e "${YELLOW}⏳ Removing all instances...${NC}\n"
    
    for instance in "${instances[@]}"; do
        remove_instance "$instance" || true
        echo ""
    done
    
    echo -e "${GREEN}✓ All instances removed.${NC}"
}

################################################################################
# LOGGING & MONITORING
################################################################################

view_instance_logs() {
    local instance="$1"
    
    if ! validate_instance "$instance"; then
        return 1
    fi
    
    local project="daks-$instance"
    
    echo -e "\n${BLUE}Live logs for $instance (Press Ctrl+C to exit)${NC}\n"
    docker compose -p "$project" logs -f 2>/dev/null || echo -e "${RED}✗ No logs found. Is the instance running?${NC}"
}

view_instance_logs_tail() {
    local instance="$1"
    local lines="${2:-50}"
    
    if ! validate_instance "$instance"; then
        return 1
    fi
    
    local project="daks-$instance"
    
    echo -e "\n${BLUE}Last $lines logs for $instance:${NC}\n"
    docker compose -p "$project" logs --tail "$lines" 2>/dev/null || echo -e "${RED}✗ No logs found.${NC}"
}

view_all_logs() {
    local instances
    mapfile -t instances < <(get_instance_list)
    
    if [[ ${#instances[@]} -eq 0 ]]; then
        echo -e "${RED}✗ No instances found.${NC}"
        return 1
    fi
    
    echo -e "\n${BLUE}Live logs for all instances (Press Ctrl+C to exit)${NC}\n"
    
    # Use tmux if available to view multiple logs, otherwise sequential
    if command -v tmux &>/dev/null; then
        local session="daks-logs-$$"
        tmux new-session -d -s "$session" -x 200 -y 50
        
        for i in "${!instances[@]}"; do
            local instance="${instances[$i]}"
            local project="daks-$instance"
            
            if [[ $i -eq 0 ]]; then
                tmux send-keys -t "$session" "docker compose -p $project logs -f" Enter
            else
                tmux split-window -t "$session" -h
                tmux send-keys -t "$session" "docker compose -p $project logs -f" Enter
            fi
        done
        
        tmux attach -t "$session"
    else
        # Fallback: show all logs sequentially
        for instance in "${instances[@]}"; do
            view_instance_logs_tail "$instance" 20
            echo ""
        done
    fi
}

show_instance_details() {
    local instance="$1"
    
    if ! validate_instance "$instance"; then
        return 1
    fi
    
    local env_file="$INSTANCES_DIR/$instance/.env"
    
    echo -e "\n${BLUE}Details for $instance:${NC}\n"
    
    echo -e "${CYAN}Port Configuration:${NC}"
    grep "^[A-Z_]*PORT=" "$env_file" | sed 's/^/  /'
    
    echo -e "\n${CYAN}Database Configuration:${NC}"
    grep "^POSTGRES_\|^DATABASE_URL=" "$env_file" | sed 's/PASSWORD=.*/PASSWORD=***REDACTED***/g' | sed 's/^/  /'
    
    echo -e "\n${CYAN}FYERS API Configuration:${NC}"
    grep "^FYERS_" "$env_file" | sed 's/FYERS_CLIENT_ID=.*/FYERS_CLIENT_ID=***REDACTED***/g' | sed 's/FYERS_SECRET_ID=.*/FYERS_SECRET_ID=***REDACTED***/g' | sed 's/FYERS_ACCESS_TOKEN=.*/FYERS_ACCESS_TOKEN=***REDACTED***/g' | sed 's/^/  /'
    
    echo -e "\n${CYAN}Environment:${NC}"
    grep "^NODE_ENV=\|^TZ=" "$env_file" | sed 's/^/  /'
    
    echo ""
}

################################################################################
# SYSTEM INFO
################################################################################

show_system_info() {
    echo -e "\n${BLUE}System Information:${NC}\n"
    
    echo -e "${CYAN}Docker Status:${NC}"
    if command -v docker &>/dev/null; then
        docker --version | sed 's/^/  /'
        if docker ps >/dev/null 2>&1; then
            echo -e "  ${GREEN}✓ Docker daemon is running${NC}"
        else
            echo -e "  ${RED}✗ Docker daemon is not running${NC}"
        fi
    else
        echo -e "  ${RED}✗ Docker is not installed${NC}"
    fi
    
    echo -e "\n${CYAN}Docker Compose Status:${NC}"
    if command -v docker &>/dev/null && docker compose version >/dev/null 2>&1; then
        docker compose version | head -n 1 | sed 's/^/  /'
        echo -e "  ${GREEN}✓ Docker Compose is available${NC}"
    else
        echo -e "  ${RED}✗ Docker Compose is not available${NC}"
    fi
    
    echo -e "\n${CYAN}Instances:${NC}"
    local instances
    mapfile -t instances < <(get_instance_list)
    if [[ ${#instances[@]} -gt 0 ]]; then
        printf '  Found: '
        printf '%s, ' "${instances[@]}" | sed 's/, $//'
        echo ""
    else
        echo "  ${YELLOW}No instances found${NC}"
    fi
    
    echo ""
}

################################################################################
# HEALTH CHECK
################################################################################

health_check() {
    local instances
    mapfile -t instances < <(get_instance_list)
    
    if [[ ${#instances[@]} -eq 0 ]]; then
        echo -e "${RED}✗ No instances found.${NC}"
        return 1
    fi
    
    echo -e "\n${BLUE}Health Check Report:${NC}\n"
    
    for instance in "${instances[@]}"; do
        local project="daks-$instance"
        local env_file="$INSTANCES_DIR/$instance/.env"
        
        echo -e "${CYAN}━━━ $instance ━━━${NC}"
        
        # Check if running
        if docker compose -p "$project" ps 2>/dev/null | grep -q "Up"; then
            echo -e "  ${GREEN}✓ Containers running${NC}"
            
            # Check port connectivity
            local backend_port
            backend_port=$(grep "^BACKEND_PORT=" "$env_file" | cut -d= -f2)
            
            if command -v nc &>/dev/null; then
                if nc -zv localhost "$backend_port" >/dev/null 2>&1; then
                    echo -e "  ${GREEN}✓ Backend port $backend_port is accessible${NC}"
                else
                    echo -e "  ${RED}✗ Backend port $backend_port is not responding${NC}"
                fi
            fi
        else
            echo -e "  ${RED}✗ Containers not running${NC}"
        fi
        
        echo ""
    done
}

################################################################################
# BACKUP & RESTORE
################################################################################

backup_instances() {
    local backup_dir="$LOG_DIR/backups/$(date +%Y%m%d_%H%M%S)"
    mkdir -p "$backup_dir"
    
    echo -e "${YELLOW}⏳ Backing up all instances to $backup_dir...${NC}\n"
    
    local instances
    mapfile -t instances < <(get_instance_list)
    
    for instance in "${instances[@]}"; do
        local project="daks-$instance"
        
        echo "  Backing up $instance..."
        docker compose -p "$project" exec -T db pg_dump -U postgres -d "$(grep '^POSTGRES_DB=' "$INSTANCES_DIR/$instance/.env" | cut -d= -f2)" > "$backup_dir/${instance}_db.sql" 2>/dev/null || echo "    (DB backup skipped or failed)"
    done
    
    echo -e "\n${GREEN}✓ Backup completed: $backup_dir${NC}"
}

################################################################################
# MAIN MENU LOOP
################################################################################

main_loop() {
    while true; do
        print_header
        print_menu
        
        read -p "Enter your choice: " choice
        
        case "$choice" in
            1)
                instance=$(select_instance "Select instance to start:" || true)
                [[ -n "$instance" ]] && start_instance "$instance"
                ;;
            2)
                instance=$(select_instance "Select instance to stop:" || true)
                [[ -n "$instance" ]] && stop_instance "$instance"
                ;;
            3)
                instance=$(select_instance "Select instance to restart:" || true)
                [[ -n "$instance" ]] && restart_instance "$instance"
                ;;
            4)
                start_all_instances
                ;;
            5)
                stop_all_instances
                ;;
            6)
                restart_all_instances
                ;;
            7)
                instance=$(select_instance "Select instance for logs:" || true)
                [[ -n "$instance" ]] && view_instance_logs "$instance"
                ;;
            8)
                view_all_logs
                ;;
            9)
                show_all_status
                ;;
            10)
                instance=$(select_instance "Select instance to check:" || true)
                [[ -n "$instance" ]] && check_instance_status "$instance"
                ;;
            11)
                instance=$(select_instance "Select instance to remove:" || true)
                [[ -n "$instance" ]] && remove_instance "$instance"
                ;;
            12)
                remove_all_instances
                ;;
            13)
                instance=$(select_instance "Select instance for details:" || true)
                [[ -n "$instance" ]] && show_instance_details "$instance"
                ;;
            0)
                echo -e "\n${CYAN}Goodbye!${NC}\n"
                exit 0
                ;;
            *)
                if [[ -n "$choice" ]]; then
                    echo -e "${RED}✗ Invalid choice. Please try again.${NC}"
                fi
                ;;
        esac
        
        read -p "Press Enter to continue..."
    done
}

################################################################################
# CLI MODE (for automation)
################################################################################

cli_mode() {
    local cmd="$1"
    shift
    
    case "$cmd" in
        start)
            local instance="${1:-}"
            if [[ -z "$instance" ]]; then
                echo "Usage: $0 start <instance-name>"
                exit 1
            fi
            start_instance "$instance" || exit 1
            ;;
        stop)
            local instance="${1:-}"
            if [[ -z "$instance" ]]; then
                echo "Usage: $0 stop <instance-name>"
                exit 1
            fi
            stop_instance "$instance" || exit 1
            ;;
        restart)
            local instance="${1:-}"
            if [[ -z "$instance" ]]; then
                echo "Usage: $0 restart <instance-name>"
                exit 1
            fi
            restart_instance "$instance" || exit 1
            ;;
        start-all)
            start_all_instances || exit 1
            ;;
        stop-all)
            stop_all_instances || exit 1
            ;;
        restart-all)
            restart_all_instances || exit 1
            ;;
        status)
            local instance="${1:-}"
            if [[ -z "$instance" ]]; then
                show_all_status
            else
                check_instance_status "$instance" || exit 1
            fi
            ;;
        logs)
            local instance="${1:-}"
            if [[ -z "$instance" ]]; then
                echo "Usage: $0 logs <instance-name>"
                exit 1
            fi
            view_instance_logs "$instance" || exit 1
            ;;
        logs-tail)
            local instance="${1:-}"
            local lines="${2:-50}"
            if [[ -z "$instance" ]]; then
                echo "Usage: $0 logs-tail <instance-name> [lines]"
                exit 1
            fi
            view_instance_logs_tail "$instance" "$lines" || exit 1
            ;;
        info)
            local instance="${1:-}"
            if [[ -z "$instance" ]]; then
                echo "Usage: $0 info <instance-name>"
                exit 1
            fi
            show_instance_details "$instance" || exit 1
            ;;
        health)
            health_check || exit 1
            ;;
        backup)
            backup_instances || exit 1
            ;;
        system-info)
            show_system_info || exit 1
            ;;
        *)
            cat << EOF

DAKS TOP-K STOCKS - Multi-Instance Manager

INTERACTIVE MODE:
  $0                    Start interactive menu

CLI MODE:
  $0 start <instance>           Start a specific instance
  $0 stop <instance>            Stop a specific instance
  $0 restart <instance>         Restart a specific instance
  $0 start-all                  Start all instances
  $0 stop-all                   Stop all instances
  $0 restart-all                Restart all instances
  $0 status [instance]          Show status (all or specific)
  $0 logs <instance>            Follow logs for an instance
  $0 logs-tail <instance> [n]   Show last n lines of logs
  $0 info <instance>            Show instance configuration
  $0 health                     Run health check for all instances
  $0 backup                     Backup all instance databases
  $0 system-info                Show Docker and system info

EXAMPLES:
  $0 start instance1
  $0 logs-tail instance2 100
  $0 status
  $0 restart-all

EOF
            exit 1
            ;;
    esac
}

################################################################################
# ENTRY POINT
################################################################################

if [[ $# -gt 0 ]]; then
    cli_mode "$@"
else
    main_loop
fi
