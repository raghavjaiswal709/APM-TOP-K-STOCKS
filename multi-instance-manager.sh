#!/bin/bash

################################################################################
# DAKS TOP-K STOCKS - Multi-Instance Manager
# Complete orchestration for running multiple independent instances
# Version: 1.0
# Date: December 22, 2025
################################################################################

set -e

# ═══════════════════════════════════════════════════════════════════════════
# CONFIGURATION
# ═══════════════════════════════════════════════════════════════════════════

PROJECT_DIR="/Users/raghav/Documents/GitHub/DAKS-TOP-K-STOCKS"
MULTI_INSTANCES_DIR="$PROJECT_DIR/multi-instances"
NUM_INSTANCES=${INSTANCES:-3}
LOG_DIR="$MULTI_INSTANCES_DIR/logs"

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# ═══════════════════════════════════════════════════════════════════════════
# UTILITY FUNCTIONS
# ═══════════════════════════════════════════════════════════════════════════

print_header() {
    echo -e "${BLUE}╔════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║${NC} $1"
    echo -e "${BLUE}╚════════════════════════════════════════════════════════════════╝${NC}"
}

print_status() {
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1"
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

# Function to create log directory
setup_logging() {
    mkdir -p "$LOG_DIR"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] - Multi-Instance Manager Started" >> "$LOG_DIR/manager.log"
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
    
    # Check if .env exists
    if [ ! -f ".env" ]; then
        print_error "Environment file not found: $instance_dir/.env"
        return 1
    fi
    
    # Source .env for port info
    source .env
    
    if docker-compose -f docker-compose.standalone.yml up -d; then
        print_success "Instance $instance_num started successfully"
        
        sleep 2
        print_status "Instance $instance_num URLs:"
        echo -e "  ${CYAN}Frontend:${NC} http://localhost:$FRONTEND_PORT"
        echo -e "  ${CYAN}Backend:${NC}  http://localhost:$BACKEND_PORT"
        echo -e "  ${CYAN}Fyers 5001:${NC} http://localhost:$FYERS_5001_PORT"
        echo -e "  ${CYAN}Fyers 5010:${NC} http://localhost:$FYERS_5010_PORT"
        echo -e "  ${CYAN}DB:${NC} localhost:$POSTGRES_PORT (user: $POSTGRES_USER)"
        echo -e "  ${CYAN}Redis:${NC} localhost:$REDIS_PORT"
        
        return 0
    else
        print_error "Failed to start Instance $instance_num"
        docker-compose -f docker-compose.standalone.yml logs | tail -20
        return 1
    fi
}

# Function to stop a single instance
stop_instance() {
    local instance_num=$1
    local instance_name="instance$instance_num"
    local instance_dir="$MULTI_INSTANCES_DIR/$instance_name"
    
    print_status "Stopping Instance $instance_num..."
    
    if [ ! -d "$instance_dir" ]; then
        print_error "Instance directory not found: $instance_dir"
        return 1
    fi
    
    cd "$instance_dir"
    
    if docker-compose -f docker-compose.standalone.yml down; then
        print_success "Instance $instance_num stopped"
        return 0
    else
        print_error "Failed to stop Instance $instance_num"
        return 1
    fi
}

# Function to restart a single instance
restart_instance() {
    local instance_num=$1
    
    print_status "Restarting Instance $instance_num..."
    stop_instance $instance_num
    sleep 2
    start_instance $instance_num
}

# Function to check instance status
check_instance_status() {
    local instance_num=$1
    local instance_name="instance$instance_num"
    local instance_dir="$MULTI_INSTANCES_DIR/$instance_name"
    
    cd "$instance_dir"
    
    print_header "Instance $instance_num Status"
    docker-compose -f docker-compose.standalone.yml ps
}

# Function to view instance logs
view_instance_logs() {
    local instance_num=$1
    local instance_name="instance$instance_num"
    local instance_dir="$MULTI_INSTANCES_DIR/$instance_name"
    local service=$2
    
    cd "$instance_dir"
    
    if [ -z "$service" ]; then
        print_status "Displaying logs for Instance $instance_num (Press Ctrl+C to exit)..."
        docker-compose -f docker-compose.standalone.yml logs -f
    else
        print_status "Displaying logs for Instance $instance_num - Service: $service (Press Ctrl+C to exit)..."
        docker-compose -f docker-compose.standalone.yml logs -f $service
    fi
}

# Function to check health of all instances
health_check() {
    print_header "Health Check - All Instances"
    
    echo ""
    local healthy=0
    local total=0
    
    for ((i=1; i<=NUM_INSTANCES; i++)); do
        instance_dir="$MULTI_INSTANCES_DIR/instance$i"
        cd "$instance_dir"
        
        if [ ! -f ".env" ]; then
            continue
        fi
        
        source .env
        
        echo -e "${CYAN}Instance $i:${NC}"
        total=$((total+6))
        
        # Frontend
        if curl -s http://localhost:$FRONTEND_PORT > /dev/null 2>&1; then
            print_success "Frontend (port $FRONTEND_PORT): OK"
            healthy=$((healthy+1))
        else
            print_error "Frontend (port $FRONTEND_PORT): FAILED"
        fi
        
        # Backend
        if curl -s http://localhost:$BACKEND_PORT/health > /dev/null 2>&1; then
            print_success "Backend (port $BACKEND_PORT): OK"
            healthy=$((healthy+1))
        else
            print_error "Backend (port $BACKEND_PORT): FAILED"
        fi
        
        # Database
        if nc -z localhost $POSTGRES_PORT > /dev/null 2>&1; then
            print_success "Database (port $POSTGRES_PORT): OK"
            healthy=$((healthy+1))
        else
            print_error "Database (port $POSTGRES_PORT): FAILED"
        fi
        
        # Redis
        if redis-cli -p $REDIS_PORT ping > /dev/null 2>&1; then
            print_success "Redis (port $REDIS_PORT): OK"
            healthy=$((healthy+1))
        else
            print_error "Redis (port $REDIS_PORT): FAILED"
        fi
        
        # Fyers 5001
        if curl -s http://localhost:$FYERS_5001_PORT > /dev/null 2>&1; then
            print_success "Fyers 5001 (port $FYERS_5001_PORT): OK"
            healthy=$((healthy+1))
        else
            print_error "Fyers 5001 (port $FYERS_5001_PORT): FAILED"
        fi
        
        # Fyers 5010
        if curl -s http://localhost:$FYERS_5010_PORT > /dev/null 2>&1; then
            print_success "Fyers 5010 (port $FYERS_5010_PORT): OK"
            healthy=$((healthy+1))
        else
            print_error "Fyers 5010 (port $FYERS_5010_PORT): FAILED"
        fi
        
        echo ""
    done
    
    if [ $total -gt 0 ]; then
        local percent=$((healthy * 100 / total))
        echo -e "${CYAN}Overall Health: $healthy/$total ($percent%)${NC}"
        if [ $percent -eq 100 ]; then
            print_success "All systems operational!"
        elif [ $percent -ge 75 ]; then
            print_warning "Most systems operational (some services down)"
        else
            print_error "Multiple services are down"
        fi
    fi
}

# Function to display resource usage
show_resource_usage() {
    print_header "Resource Usage - All Instances"
    docker stats --no-stream
}

# Function to generate summary report
generate_report() {
    print_header "Multi-Instance Summary Report"
    
    echo ""
    echo "Total Instances: $NUM_INSTANCES"
    echo "Setup Directory: $MULTI_INSTANCES_DIR"
    echo ""
    
    for ((i=1; i<=NUM_INSTANCES; i++)); do
        instance_dir="$MULTI_INSTANCES_DIR/instance$i"
        
        if [ ! -f "$instance_dir/.env" ]; then
            continue
        fi
        
        cd "$instance_dir"
        source .env
        
        echo -e "${CYAN}Instance $i Configuration:${NC}"
        echo "  ID: $INSTANCE_ID"
        echo "  Frontend Port: $FRONTEND_PORT"
        echo "  Backend Port: $BACKEND_PORT"
        echo "  Database: $POSTGRES_DB"
        echo "  Database Port: $POSTGRES_PORT"
        echo "  Redis Port: $REDIS_PORT"
        echo "  Fyers 5001 Port: $FYERS_5001_PORT"
        echo "  Fyers 5010 Port: $FYERS_5010_PORT"
        echo ""
    done
}

# Function to display help
show_help() {
    print_header "DAKS Multi-Instance Manager - Help"
    
    echo ""
    echo "Usage: $0 <command> [options]"
    echo ""
    echo "COMMANDS:"
    echo ""
    echo "  LIFECYCLE MANAGEMENT:"
    echo "    start-all              - Start all instances"
    echo "    stop-all               - Stop all instances"
    echo "    restart-all            - Restart all instances"
    echo "    start <num>            - Start specific instance"
    echo "    stop <num>             - Stop specific instance"
    echo "    restart <num>          - Restart specific instance"
    echo ""
    echo "  STATUS & MONITORING:"
    echo "    status                 - Show status of all instances"
    echo "    status <num>           - Show status of specific instance"
    echo "    health-check           - Check health of all instances"
    echo "    resources              - Show resource usage"
    echo "    report                 - Generate summary report"
    echo ""
    echo "  LOGS & DEBUGGING:"
    echo "    logs <num> [service]   - View logs for instance (optional: specific service)"
    echo "    shell <num> <service>  - Open shell in container"
    echo ""
    echo "  SETUP & CONFIGURATION:"
    echo "    setup <num>            - Setup specific instance"
    echo "    setup-all              - Setup all instances from template"
    echo ""
    echo "  DATABASE OPERATIONS:"
    echo "    db-backup <num>        - Backup database for instance"
    echo "    db-restore <num>       - Restore database for instance"
    echo "    db-shell <num>         - Open psql shell for instance"
    echo ""
    echo "OPTIONS:"
    echo "    -n, --instances NUM    - Set number of instances"
    echo "    -h, --help             - Show this help message"
    echo "    -v, --verbose          - Verbose output"
    echo ""
    echo "EXAMPLES:"
    echo "    $0 start-all"
    echo "    $0 start 1"
    echo "    $0 logs 2"
    echo "    $0 logs 1 backend"
    echo "    $0 health-check"
    echo "    $0 shell 1 backend"
    echo "    $0 db-backup 1"
    echo ""
}

# Function to open shell in container
open_shell() {
    local instance_num=$1
    local service=$2
    local instance_name="instance$instance_num"
    local instance_dir="$MULTI_INSTANCES_DIR/$instance_name"
    
    if [ -z "$service" ]; then
        print_error "Please specify service (backend, frontend, db, redis, fyers-5001, fyers-5010)"
        return 1
    fi
    
    cd "$instance_dir"
    
    print_status "Opening shell in $service container for Instance $instance_num..."
    docker-compose -f docker-compose.standalone.yml exec $service /bin/bash
}

# Function to backup database
backup_database() {
    local instance_num=$1
    local instance_name="instance$instance_num"
    local instance_dir="$MULTI_INSTANCES_DIR/$instance_name"
    
    cd "$instance_dir"
    source .env
    
    mkdir -p "$instance_dir/backups"
    local backup_file="$instance_dir/backups/backup_$(date +%Y%m%d_%H%M%S).sql"
    
    print_status "Backing up database for Instance $instance_num..."
    
    docker-compose -f docker-compose.standalone.yml exec -T db pg_dump -U $POSTGRES_USER $POSTGRES_DB > "$backup_file"
    
    if [ $? -eq 0 ]; then
        print_success "Database backed up to: $backup_file"
        ls -lh "$backup_file"
    else
        print_error "Backup failed"
        return 1
    fi
}

# Function to restore database
restore_database() {
    local instance_num=$1
    local backup_file=$2
    local instance_name="instance$instance_num"
    local instance_dir="$MULTI_INSTANCES_DIR/$instance_name"
    
    if [ -z "$backup_file" ] || [ ! -f "$backup_file" ]; then
        print_error "Backup file not found: $backup_file"
        return 1
    fi
    
    cd "$instance_dir"
    source .env
    
    print_warning "This will overwrite the current database. Continue? (y/n)"
    read -r response
    
    if [ "$response" != "y" ]; then
        print_warning "Restore cancelled"
        return 0
    fi
    
    print_status "Restoring database for Instance $instance_num..."
    
    cat "$backup_file" | docker-compose -f docker-compose.standalone.yml exec -T db psql -U $POSTGRES_USER $POSTGRES_DB
    
    if [ $? -eq 0 ]; then
        print_success "Database restored successfully"
    else
        print_error "Restore failed"
        return 1
    fi
}

# ═══════════════════════════════════════════════════════════════════════════
# MAIN SCRIPT
# ═══════════════════════════════════════════════════════════════════════════

# Setup logging
setup_logging

# Parse arguments
COMMAND=$1
INSTANCE_NUM=${2:-1}
SERVICE=${3:-}

# Handle help
if [ -z "$COMMAND" ] || [ "$COMMAND" = "-h" ] || [ "$COMMAND" = "--help" ]; then
    show_help
    exit 0
fi

# Execute commands
case "$COMMAND" in
    start-all)
        print_header "Starting All Instances"
        for ((i=1; i<=NUM_INSTANCES; i++)); do
            start_instance $i
            sleep 3
        done
        print_success "All instances started!"
        echo ""
        health_check
        ;;
    
    stop-all)
        print_header "Stopping All Instances"
        for ((i=1; i<=NUM_INSTANCES; i++)); do
            stop_instance $i
            sleep 1
        done
        print_success "All instances stopped!"
        ;;
    
    restart-all)
        print_header "Restarting All Instances"
        for ((i=1; i<=NUM_INSTANCES; i++)); do
            restart_instance $i
            sleep 3
        done
        print_success "All instances restarted!"
        echo ""
        health_check
        ;;
    
    status)
        if [ -z "$INSTANCE_NUM" ] || [ "$INSTANCE_NUM" = "all" ]; then
            for ((i=1; i<=NUM_INSTANCES; i++)); do
                check_instance_status $i
                echo ""
            done
        else
            check_instance_status $INSTANCE_NUM
        fi
        ;;
    
    logs)
        view_instance_logs $INSTANCE_NUM "$SERVICE"
        ;;
    
    start)
        start_instance $INSTANCE_NUM
        ;;
    
    stop)
        stop_instance $INSTANCE_NUM
        ;;
    
    restart)
        restart_instance $INSTANCE_NUM
        ;;
    
    health-check)
        health_check
        ;;
    
    resources)
        show_resource_usage
        ;;
    
    report)
        generate_report
        health_check
        ;;
    
    shell)
        open_shell $INSTANCE_NUM "$SERVICE"
        ;;
    
    db-backup)
        backup_database $INSTANCE_NUM
        ;;
    
    db-restore)
        restore_database $INSTANCE_NUM "$SERVICE"
        ;;
    
    db-shell)
        instance_dir="$MULTI_INSTANCES_DIR/instance$INSTANCE_NUM"
        cd "$instance_dir"
        source .env
        print_status "Opening database shell for Instance $INSTANCE_NUM..."
        docker-compose -f docker-compose.standalone.yml exec db psql -U $POSTGRES_USER -d $POSTGRES_DB
        ;;
    
    help)
        show_help
        ;;
    
    *)
        print_error "Unknown command: $COMMAND"
        echo "Use: $0 help (to see available commands)"
        exit 1
        ;;
esac

exit 0
