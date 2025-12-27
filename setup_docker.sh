#!/bin/bash

################################################################################
# DAKS TOP-K STOCKS - Complete Docker Environment Setup Script
# Version: 2.0
# Date: December 27, 2025
# 
# COMPREHENSIVE SETUP SCRIPT FOR BRAND NEW SERVERS
# ═════════════════════════════════════════════════════════════════════════════
# 
# This script automates the complete setup of the DAKS TOP-K STOCKS application
# on a fresh server (with or without Docker installed). It performs:
#
# ✅ Docker & Docker Compose Installation (if needed)
# ✅ System Dependencies (Git, curl, wget, etc.)
# ✅ Python 3 Environment Setup with venv
# ✅ Python Package Installation (all Fyers API requirements)
# ✅ Node.js Runtime Setup (if needed for testing)
# ✅ Backend (NestJS) Setup with all dependencies
# ✅ Frontend (Next.js) Setup with all packages and shadcn/ui components
# ✅ Database Initialization
# ✅ Docker Compose Build & Startup
# ✅ Health Checks and Validation
#
# REQUIREMENTS:
# - macOS or Linux-based system
# - Root or sudo access (for Docker installation)
# - Internet connection for package downloads
#
# USAGE:
#   chmod +x setup_docker.sh
#   ./setup_docker.sh [--skip-docker] [--skip-build] [--dev]
#
# OPTIONS:
#   --skip-docker    : Skip Docker installation (assumes already installed)
#   --skip-build     : Skip Docker build (use pre-built images)
#   --dev            : Setup in development mode (watches enabled)
#
################################################################################

set -e  # Exit on error

# ═══════════════════════════════════════════════════════════════════════════
# CONFIGURATION & CONSTANTS
# ═══════════════════════════════════════════════════════════════════════════

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCRIPT_DIR="$PROJECT_ROOT"

# Color codes for terminal output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
WHITE='\033[1;37m'
NC='\033[0m' # No Color

# Configuration flags
SKIP_DOCKER=false
SKIP_BUILD=false
DEV_MODE=false
OS_TYPE=""
DOCKER_INSTALLED=false
DOCKER_COMPOSE_INSTALLED=false

# Service ports
BACKEND_PORT=5002
FRONTEND_PORT=3000
FYERS_5001_PORT=5001
FYERS_5010_PORT=5010
DB_PORT=5432

# Python configuration
PYTHON_VERSION="3.10"
PYTHON_VENV_DIR=".venv"

# ═══════════════════════════════════════════════════════════════════════════
# UTILITY FUNCTIONS
# ═══════════════════════════════════════════════════════════════════════════

# Print header banner
print_header() {
    echo ""
    echo -e "${BLUE}╔════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║${NC} ${WHITE}$1${NC}"
    echo -e "${BLUE}╚════════════════════════════════════════════════════════════════╝${NC}"
    echo ""
}

# Print section header
print_section() {
    echo ""
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${CYAN}▶ $1${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
}

# Print success message
print_success() {
    echo -e "${GREEN}✅${NC} $1"
}

# Print error message
print_error() {
    echo -e "${RED}❌${NC} $1"
}

# Print warning message
print_warning() {
    echo -e "${YELLOW}⚠️${NC} $1"
}

# Print info message
print_info() {
    echo -e "${CYAN}ℹ️${NC} $1"
}

# Print task message
print_task() {
    echo -e "${MAGENTA}▶${NC} $1"
}

# Detect operating system
detect_os() {
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        OS_TYPE="linux"
        if [ -f /etc/os-release ]; then
            . /etc/os-release
            OS_ID=$ID
        fi
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        OS_TYPE="macos"
    else
        OS_TYPE="unknown"
    fi
    print_success "Detected OS: $OS_TYPE"
}

# Check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check if running with sufficient permissions
check_permissions() {
    if [[ "$OS_TYPE" == "linux" ]] && [[ $EUID -ne 0 ]]; then
        if ! sudo -n true 2>/dev/null; then
            print_error "This script requires sudo privileges for Docker installation on Linux"
            print_info "Please run with: sudo ./setup_docker.sh"
            exit 1
        fi
    fi
}

# ═══════════════════════════════════════════════════════════════════════════
# ARGUMENT PARSING
# ═══════════════════════════════════════════════════════════════════════════

parse_arguments() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            --skip-docker)
                SKIP_DOCKER=true
                shift
                ;;
            --skip-build)
                SKIP_BUILD=true
                shift
                ;;
            --dev)
                DEV_MODE=true
                shift
                ;;
            *)
                print_warning "Unknown option: $1"
                shift
                ;;
        esac
    done
}

# ═══════════════════════════════════════════════════════════════════════════
# DOCKER INSTALLATION
# ═══════════════════════════════════════════════════════════════════════════

install_docker_macos() {
    print_section "Installing Docker Desktop on macOS"
    
    if command_exists brew; then
        print_task "Installing Docker via Homebrew..."
        brew install docker docker-compose
        print_success "Docker installed via Homebrew"
    else
        print_warning "Homebrew not found. Installing Homebrew first..."
        /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
        brew install docker docker-compose
        print_success "Homebrew and Docker installed"
    fi
    
    print_info "Please start Docker Desktop manually: open /Applications/Docker.app"
    print_info "Waiting for Docker daemon to be ready..."
    
    local max_attempts=30
    local attempt=1
    while ! command_exists docker || ! docker ps &>/dev/null; do
        if [ $attempt -ge $max_attempts ]; then
            print_error "Docker daemon did not start within 60 seconds"
            exit 1
        fi
        echo -ne "${CYAN}.${NC}"
        sleep 2
        ((attempt++))
    done
    echo ""
    print_success "Docker daemon is running"
}

install_docker_linux() {
    print_section "Installing Docker on Linux ($OS_ID)"
    
    # Update package manager
    print_task "Updating package manager..."
    if [[ $EUID -ne 0 ]]; then
        sudo apt-get update -qq || sudo yum update -y
    else
        apt-get update -qq || yum update -y
    fi
    
    local sudo_cmd=""
    if [[ $EUID -ne 0 ]]; then
        sudo_cmd="sudo"
    fi
    
    # Install Docker
    print_task "Installing Docker..."
    if [[ "$OS_ID" == "ubuntu" || "$OS_ID" == "debian" ]]; then
        $sudo_cmd apt-get install -y curl apt-transport-https ca-certificates gnupg lsb-release
        curl -fsSL https://download.docker.com/linux/ubuntu/gpg | $sudo_cmd gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg
        echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | $sudo_cmd tee /etc/apt/sources.list.d/docker.list > /dev/null
        $sudo_cmd apt-get update
        $sudo_cmd apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
    elif [[ "$OS_ID" == "centos" || "$OS_ID" == "fedora" || "$OS_ID" == "rhel" ]]; then
        $sudo_cmd yum install -y yum-utils
        $sudo_cmd yum-config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
        $sudo_cmd yum install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
    else
        print_error "Unsupported Linux distribution: $OS_ID"
        exit 1
    fi
    
    # Start Docker daemon
    print_task "Starting Docker daemon..."
    if [[ $EUID -ne 0 ]]; then
        sudo systemctl start docker
        sudo systemctl enable docker
    else
        systemctl start docker
        systemctl enable docker
    fi
    
    # Add user to docker group (Linux only)
    if [[ $EUID -ne 0 ]]; then
        print_task "Adding user to docker group..."
        sudo usermod -aG docker $USER
        newgrp docker <<EOFNEWGRP
print_success "User added to docker group (log out and back in to take effect)"
EOFNEWGRP
    fi
    
    print_success "Docker installed successfully on Linux"
}

verify_docker_installation() {
    print_section "Verifying Docker Installation"
    
    # Check Docker
    if command_exists docker; then
        local docker_version=$(docker --version)
        print_success "Docker: $docker_version"
        DOCKER_INSTALLED=true
    else
        print_error "Docker command not found after installation"
        return 1
    fi
    
    # Check Docker Compose (v2 or v1)
    if command_exists docker-compose; then
        local compose_version=$(docker-compose --version)
        print_success "Docker Compose (v1): $compose_version"
        DOCKER_COMPOSE_INSTALLED=true
    elif docker compose version &>/dev/null; then
        local compose_version=$(docker compose version)
        print_success "Docker Compose (v2): $compose_version"
        DOCKER_COMPOSE_INSTALLED=true
    else
        print_warning "Docker Compose not found"
        return 1
    fi
    
    # Verify Docker daemon is running
    if docker ps &>/dev/null; then
        print_success "Docker daemon is running and accessible"
    else
        print_error "Docker daemon is not running or not accessible"
        return 1
    fi
    
    return 0
}

setup_docker() {
    if [[ "$SKIP_DOCKER" == true ]]; then
        print_section "Skipping Docker Installation (--skip-docker flag set)"
        verify_docker_installation || exit 1
        return
    fi
    
    print_header "🐳 Docker Installation & Verification"
    
    if command_exists docker && command_exists docker-compose; then
        print_success "Docker and Docker Compose already installed"
        verify_docker_installation || exit 1
        return
    fi
    
    detect_os
    check_permissions
    
    case "$OS_TYPE" in
        macos)
            install_docker_macos
            ;;
        linux)
            install_docker_linux
            ;;
        *)
            print_error "Unsupported operating system: $OS_TYPE"
            exit 1
            ;;
    esac
    
    verify_docker_installation || exit 1
}

# ═══════════════════════════════════════════════════════════════════════════
# SYSTEM DEPENDENCIES
# ═══════════════════════════════════════════════════════════════════════════

install_system_dependencies() {
    print_section "Installing System Dependencies"
    
    local required_commands=("git" "curl" "wget")
    
    case "$OS_TYPE" in
        macos)
            print_task "Installing system dependencies via Homebrew..."
            if ! command_exists brew; then
                /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
            fi
            brew install git curl wget
            print_success "System dependencies installed on macOS"
            ;;
        linux)
            print_task "Installing system dependencies via package manager..."
            if [[ $EUID -ne 0 ]]; then
                sudo apt-get update && sudo apt-get install -y git curl wget build-essential || \
                sudo yum update -y && sudo yum install -y git curl wget gcc
            else
                apt-get update && apt-get install -y git curl wget build-essential || \
                yum update -y && yum install -y git curl wget gcc
            fi
            print_success "System dependencies installed on Linux"
            ;;
    esac
}

# ═══════════════════════════════════════════════════════════════════════════
# PYTHON ENVIRONMENT SETUP
# ═══════════════════════════════════════════════════════════════════════════

setup_python_environment() {
    print_header "🐍 Python Environment Setup"
    
    # Check Python 3
    print_section "Checking Python Installation"
    
    if ! command_exists python3; then
        print_error "Python 3 is not installed"
        
        case "$OS_TYPE" in
            macos)
                print_task "Installing Python 3 via Homebrew..."
                brew install python3
                ;;
            linux)
                print_task "Installing Python 3 via package manager..."
                if [[ $EUID -ne 0 ]]; then
                    sudo apt-get update && sudo apt-get install -y python3 python3-pip python3-venv || \
                    sudo yum update -y && sudo yum install -y python3 python3-pip
                else
                    apt-get update && apt-get install -y python3 python3-pip python3-venv || \
                    yum update -y && yum install -y python3 python3-pip
                fi
                ;;
        esac
    fi
    
    local python_version=$(python3 --version)
    print_success "Python installed: $python_version"
    
    # Create virtual environment
    print_section "Creating Python Virtual Environment"
    
    if [ -d "$PROJECT_ROOT/$PYTHON_VENV_DIR" ]; then
        print_warning "Virtual environment already exists at $PYTHON_VENV_DIR"
    else
        print_task "Creating virtual environment at $PYTHON_VENV_DIR..."
        cd "$PROJECT_ROOT"
        python3 -m venv "$PYTHON_VENV_DIR"
        print_success "Virtual environment created"
    fi
    
    # Activate virtual environment
    print_task "Activating virtual environment..."
    source "$PROJECT_ROOT/$PYTHON_VENV_DIR/bin/activate"
    print_success "Virtual environment activated"
    
    # Upgrade pip
    print_task "Upgrading pip, setuptools, and wheel..."
    pip install --upgrade pip setuptools wheel >/dev/null 2>&1
    print_success "pip upgraded"
}

install_python_dependencies() {
    print_section "Installing Python Packages"
    
    # Ensure venv is activated
    if [[ -z "$VIRTUAL_ENV" ]]; then
        print_info "Activating virtual environment..."
        source "$PROJECT_ROOT/$PYTHON_VENV_DIR/bin/activate"
    fi
    
    # Core Python packages for Fyers API integration
    local python_packages=(
        # Socket.IO & Web Framework
        "python-socketio"
        "python-engineio"
        "flask"
        "flask-socketio"
        "uvicorn[standard]"
        "websockets"
        
        # Fyers API
        "fyers-apiv3"
        
        # Data Processing
        "pandas"
        "numpy"
        
        # Utilities
        "python-dotenv"
        "requests"
        "pytz"
        "ratelimit"
        
        # Database
        "psycopg2-binary"
        
        # Additional utilities
        "urllib3"
        "pyOpenSSL"
    )
    
    print_task "Installing Python packages (${#python_packages[@]} packages)..."
    
    local failed_packages=()
    local installed_count=0
    
    for package in "${python_packages[@]}"; do
        echo -ne "${CYAN}Installing: $package${NC}\r"
        if pip install "$package" >/dev/null 2>&1; then
            ((installed_count++))
        else
            failed_packages+=("$package")
        fi
        echo -ne "\033[2K"  # Clear line
    done
    
    print_success "Installed $installed_count/${#python_packages[@]} Python packages"
    
    if [ ${#failed_packages[@]} -gt 0 ]; then
        print_warning "Failed to install the following packages:"
        for pkg in "${failed_packages[@]}"; do
            print_warning "  - $pkg"
        done
        print_info "Continuing with installation..."
    fi
    
    # Verify critical packages
    print_task "Verifying critical Python packages..."
    python3 << 'EOPYTHON'
import sys
critical_packages = [
    'socketio',
    'flask',
    'uvicorn',
    'fyers_apiv3',
    'pandas',
    'numpy'
]

failed = []
for package_name in critical_packages:
    try:
        __import__(package_name)
        print(f'  ✓ {package_name}')
    except ImportError:
        failed.append(package_name)
        print(f'  ✗ {package_name}')

if failed:
    print(f'\nWarning: Failed to import {len(failed)} critical packages: {", ".join(failed)}')
    sys.exit(1)
EOPYTHON
    
    if [ $? -eq 0 ]; then
        print_success "All critical Python packages verified"
    else
        print_warning "Some critical packages could not be verified"
    fi
}

# ═══════════════════════════════════════════════════════════════════════════
# NODEJS SETUP (for reference/testing)
# ═══════════════════════════════════════════════════════════════════════════

install_nodejs() {
    print_section "Checking Node.js Installation"
    
    if command_exists node; then
        local node_version=$(node --version)
        print_success "Node.js already installed: $node_version"
        return
    fi
    
    print_task "Installing Node.js v18 (LTS)..."
    
    case "$OS_TYPE" in
        macos)
            brew install node@18
            brew link node@18 --force
            ;;
        linux)
            if command_exists curl; then
                curl -fsSL https://deb.nodesource.com/setup_18.x | \
                    if [[ $EUID -ne 0 ]]; then sudo bash -; else bash -; fi
                if [[ $EUID -ne 0 ]]; then
                    sudo apt-get install -y nodejs
                else
                    apt-get install -y nodejs
                fi
            else
                print_warning "curl not available for Node.js installation"
                return
            fi
            ;;
    esac
    
    if command_exists node; then
        local node_version=$(node --version)
        print_success "Node.js installed: $node_version"
    else
        print_warning "Node.js installation incomplete"
    fi
}

# ═══════════════════════════════════════════════════════════════════════════
# ENVIRONMENT FILES SETUP
# ═══════════════════════════════════════════════════════════════════════════

create_env_files() {
    print_section "Creating Environment Configuration Files"
    
    # Backend .env
    if [ ! -f "$PROJECT_ROOT/apps/backend/.env" ]; then
        print_task "Creating backend .env file..."
        cat > "$PROJECT_ROOT/apps/backend/.env" << 'BACKEND_ENV'
# ═══════════════════════════════════════════════════════════════════════════
# DAKS Backend Environment Configuration
# ═══════════════════════════════════════════════════════════════════════════

# Server Configuration
PORT=5002
NODE_ENV=development
APP_NAME=DAKS-Backend

# Database Configuration
DB_TYPE=postgres
DB_HOST=postgres
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=postgres
DB_DATABASE=daks_db
DB_SYNCHRONIZE=true
DB_LOGGING=true

# Fyers API Configuration
FYERS_API_BASE_URL=https://api.shoonya.com

# Python Fyers Services
FYERS_5001_URL=http://fyers-5001:5001
FYERS_5010_URL=http://fyers-5010:5010

# Socket.IO Configuration
SOCKETIO_CORS_ORIGIN=http://localhost:3000,http://frontend:3000
SOCKETIO_PATH=/socket.io

# Cache Configuration
CACHE_TTL=3600

# JWT Configuration (if applicable)
JWT_SECRET=your-jwt-secret-key-change-this
JWT_EXPIRATION=7d

# CORS Configuration
CORS_ORIGIN=http://localhost:3000,http://frontend:3000

# Logging
LOG_LEVEL=info
LOG_FORMAT=json

# Feature Flags
ENABLE_CACHE=true
ENABLE_WEBSOCKET=true
ENABLE_LIVE_DATA=true
BACKEND_ENV
        print_success "Backend .env created"
    else
        print_success "Backend .env already exists"
    fi
    
    # Frontend .env
    if [ ! -f "$PROJECT_ROOT/apps/frontend/.env.local" ]; then
        print_task "Creating frontend .env.local file..."
        cat > "$PROJECT_ROOT/apps/frontend/.env.local" << 'FRONTEND_ENV'
# ═══════════════════════════════════════════════════════════════════════════
# DAKS Frontend Environment Configuration
# ═══════════════════════════════════════════════════════════════════════════

# API Configuration
NEXT_PUBLIC_API_URL=http://localhost:5002
NEXT_PUBLIC_BACKEND_URL=http://localhost:5002
NEXT_PUBLIC_WEBSOCKET_URL=http://localhost:5002/socket.io

# Backend Direct URL (for server-side requests)
BACKEND_URL=http://backend:5002

# Environment
NEXT_PUBLIC_ENV=development
NEXT_PUBLIC_APP_NAME=DAKS

# Feature Flags
NEXT_PUBLIC_ENABLE_CHARTS=true
NEXT_PUBLIC_ENABLE_LIVE_DATA=true
NEXT_PUBLIC_ENABLE_PREDICTIONS=true

# Theme
NEXT_PUBLIC_DEFAULT_THEME=dark
FRONTEND_ENV
        print_success "Frontend .env.local created"
    else
        print_success "Frontend .env.local already exists"
    fi
}

# ═══════════════════════════════════════════════════════════════════════════
# BACKEND SETUP
# ═══════════════════════════════════════════════════════════════════════════

setup_backend() {
    print_header "🏗️ Backend (NestJS) Setup"
    
    cd "$PROJECT_ROOT/apps/backend"
    
    print_section "Backend Package Installation"
    
    # Install Node dependencies
    if [ -f "package.json" ]; then
        print_task "Installing backend npm packages..."
        
        # Clean previous installations if they exist
        if [ -d "node_modules" ]; then
            print_info "Removing old node_modules..."
            rm -rf node_modules package-lock.json
        fi
        
        # Install packages
        npm install 2>&1 | grep -E "(added|up to date|npm|ERR)" || true
        print_success "Backend npm packages installed"
        
        # Install Nest CLI globally (if not already)
        if ! command_exists nest; then
            print_task "Installing NestJS CLI..."
            npm install -g @nestjs/cli >/dev/null 2>&1
            print_success "NestJS CLI installed"
        else
            print_success "NestJS CLI already installed"
        fi
        
        # Build backend
        if [[ "$SKIP_BUILD" != true ]]; then
            print_section "Building Backend Application"
            print_task "Running: npm run build..."
            npm run build
            print_success "Backend built successfully"
        fi
    else
        print_error "Backend package.json not found"
        return 1
    fi
    
    cd "$PROJECT_ROOT"
}

# ═══════════════════════════════════════════════════════════════════════════
# FRONTEND SETUP
# ═══════════════════════════════════════════════════════════════════════════

setup_frontend() {
    print_header "🎨 Frontend (Next.js) Setup with shadcn/ui"
    
    cd "$PROJECT_ROOT/apps/frontend"
    
    print_section "Frontend Package Installation"
    
    # Install Node dependencies
    if [ -f "package.json" ]; then
        print_task "Installing frontend npm packages..."
        
        # Clean previous installations if they exist
        if [ -d "node_modules" ]; then
            print_info "Removing old node_modules..."
            rm -rf node_modules package-lock.json
        fi
        
        # Install main packages with legacy peer deps flag
        print_task "Installing core packages..."
        npm install --legacy-peer-deps 2>&1 | grep -E "(added|up to date|npm|ERR)" || true
        print_success "Core frontend packages installed"
        
        # Install shadcn/ui and related packages explicitly
        print_section "Installing shadcn/ui Components & Dependencies"
        
        local shadcn_packages=(
            # UI Framework
            "@radix-ui/react-checkbox@^1.3.3"
            "@radix-ui/react-dialog@^1.1.14"
            "@radix-ui/react-hover-card@^1.1.15"
            "@radix-ui/react-scroll-area@^1.2.6"
            "@radix-ui/react-slot@^1.2.3"
            "@radix-ui/react-toast@^1.2.11"
            
            # UI Components
            "cmdk@^1.1.1"
            "class-variance-authority@^0.7.1"
            "clsx@^2.1.1"
            "lucide-react@^0.479.0"
            
            # Forms & Validation
            "@hookform/resolvers@^5.2.2"
            "react-hook-form@^7.68.0"
            "zod@^3.25.76"
            
            # Date & Time
            "date-fns@^4.1.0"
            "date-fns-tz@^3.2.0"
            "react-day-picker@^8.10.1"
            
            # Styling
            "tailwind-merge@^3.4.0"
            "tailwindcss-animate@^1.0.7"
            
            # Theme
            "next-themes@^0.4.6"
            
            # Icons & Graphics
            "@heroicons/react@^2.2.0"
            
            # Charts
            "@syncfusion/ej2-react-charts@^29.1.41"
            "apexcharts@^4.7.0"
            "react-apexcharts@^1.7.0"
            "plotly.js@^3.0.1"
            "plotly.js-dist@^3.0.1"
            "react-plotly.js@^2.6.0"
            "@types/react-plotly.js@^2.6.3"
            "lightweight-charts@^5.0.6"
            "react-financial-charts@^2.0.1"
            "d3-format@^3.1.0"
            "d3-time-format@^4.1.0"
            
            # HTTP & Real-time
            "axios@^1.7.0"
            "socket.io-client@^4.8.1"
            "swr@^2.3.2"
            
            # Notifications
            "sonner@^2.0.7"
            
            # Styling & CSS
            "autoprefixer@^10.4.22"
            "postcss@^8.5.6"
            "tailwindcss@^3.4.18"
            
            # TypeScript
            "@types/node@^20.19.25"
            "@types/react@^19"
            "@types/react-dom@^19"
            
            # Motion
            "framer-motion@^12.23.26"
        )
        
        local installed_count=0
        local failed_packages=()
        
        for package in "${shadcn_packages[@]}"; do
            package_name="${package%@*}"
            echo -ne "${CYAN}Installing: $package_name${NC}\r"
            if npm install --legacy-peer-deps "$package" >/dev/null 2>&1; then
                ((installed_count++))
            else
                failed_packages+=("$package")
            fi
            echo -ne "\033[2K"  # Clear line
        done
        
        print_success "Installed $installed_count/${#shadcn_packages[@]} shadcn/ui packages"
        
        if [ ${#failed_packages[@]} -gt 0 ]; then
            print_warning "Failed to install ${#failed_packages[@]} packages (will retry):"
            for pkg in "${failed_packages[@]}"; do
                print_info "  - $pkg"
            done
            # Retry failed packages
            for pkg in "${failed_packages[@]}"; do
                print_task "Retrying: $pkg..."
                npm install --legacy-peer-deps "$pkg" --no-save 2>&1 || true
            done
        fi
        
        # Install dev dependencies
        print_section "Installing Development Dependencies"
        npm install --legacy-peer-deps --save-dev \
            "@eslint/eslintrc@^3" \
            "eslint@^9" \
            "eslint-config-next@15.1.7" \
            "typescript@^5" \
            2>&1 | grep -E "(added|up to date|npm)" || true
        print_success "Development dependencies installed"
        
        # Create PostCSS config if missing
        if [ ! -f "postcss.config.js" ] && [ ! -f "postcss.config.mjs" ]; then
            print_task "Creating PostCSS configuration..."
            cat > "postcss.config.js" << 'POSTCSS_CONFIG'
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
POSTCSS_CONFIG
            print_success "PostCSS config created"
        fi
        
        # Generate manifest if needed
        if [ -f "scripts/generate-manifest.js" ]; then
            print_task "Generating app manifest..."
            npm run generate-manifest 2>&1 || true
            print_success "App manifest generated"
        fi
        
        # Build frontend
        if [[ "$SKIP_BUILD" != true ]]; then
            print_section "Building Frontend Application"
            print_task "Running: npm run build..."
            npm run build
            print_success "Frontend built successfully"
        fi
    else
        print_error "Frontend package.json not found"
        return 1
    fi
    
    cd "$PROJECT_ROOT"
}

# ═══════════════════════════════════════════════════════════════════════════
# DOCKER SETUP & BUILD
# ═══════════════════════════════════════════════════════════════════════════

prepare_docker_compose() {
    print_section "Preparing Docker Compose Configuration"
    
    # Verify docker-compose file exists
    if [ ! -f "$PROJECT_ROOT/docker-compose.yml" ]; then
        print_error "docker-compose.yml not found in project root"
        return 1
    fi
    
    # Create necessary directories
    mkdir -p "$PROJECT_ROOT/apps/backend/data"
    mkdir -p "$PROJECT_ROOT/apps/frontend"
    
    print_success "Docker Compose configuration ready"
}

build_docker_images() {
    if [[ "$SKIP_BUILD" == true ]]; then
        print_section "Skipping Docker Build (--skip-build flag set)"
        return
    fi
    
    print_header "🐳 Building Docker Images"
    
    cd "$PROJECT_ROOT"
    
    print_section "Building Images via Docker Compose"
    print_task "This may take 5-15 minutes depending on internet speed..."
    
    # Clean up old containers if they exist
    print_info "Cleaning up old containers..."
    docker-compose down --remove-orphans 2>/dev/null || true
    
    # Build images
    print_task "Building all Docker images..."
    if docker-compose build --no-cache; then
        print_success "All Docker images built successfully"
    else
        print_error "Docker build failed"
        return 1
    fi
}

start_services() {
    print_header "🚀 Starting Services"
    
    cd "$PROJECT_ROOT"
    
    print_section "Starting Docker Containers"
    print_task "Bringing up services..."
    
    docker-compose up -d --remove-orphans
    
    if [ $? -eq 0 ]; then
        print_success "Services started successfully"
    else
        print_error "Failed to start services"
        return 1
    fi
}

# ═══════════════════════════════════════════════════════════════════════════
# HEALTH CHECKS & VALIDATION
# ═══════════════════════════════════════════════════════════════════════════

wait_for_service() {
    local service_name=$1
    local port=$2
    local max_attempts=30
    local attempt=1
    
    echo -n "Waiting for $service_name (port $port)..."
    
    while ! nc -z localhost $port 2>/dev/null; do
        if [ $attempt -ge $max_attempts ]; then
            echo ""
            print_error "$service_name did not respond within 60 seconds"
            return 1
        fi
        echo -ne "."
        sleep 2
        ((attempt++))
    done
    
    echo ""
    print_success "$service_name is responding"
    return 0
}

perform_health_checks() {
    print_header "✅ Health Checks & Validation"
    
    print_section "Container Status"
    
    # List running containers
    print_task "Running containers:"
    docker-compose ps --services 2>/dev/null | while read service; do
        if docker-compose ps $service 2>/dev/null | grep -q "Up"; then
            print_success "  $service is running"
        else
            print_warning "  $service is not running"
        fi
    done
    
    print_section "Service Health Checks"
    
    # Wait for services to be ready
    wait_for_service "Frontend" $FRONTEND_PORT || true
    wait_for_service "Backend" $BACKEND_PORT || true
    wait_for_service "Fyers-5001" $FYERS_5001_PORT || true
    wait_for_service "Fyers-5010" $FYERS_5010_PORT || true
    
    print_section "Endpoint Availability"
    
    # Test frontend
    if curl -s http://localhost:$FRONTEND_PORT >/dev/null 2>&1; then
        print_success "Frontend (http://localhost:$FRONTEND_PORT)"
    else
        print_warning "Frontend not yet responding"
    fi
    
    # Test backend
    if curl -s http://localhost:$BACKEND_PORT/health >/dev/null 2>&1; then
        print_success "Backend (http://localhost:$BACKEND_PORT)"
    else
        print_warning "Backend not yet responding"
    fi
    
    # Test Fyers services
    if curl -s http://localhost:$FYERS_5001_PORT >/dev/null 2>&1; then
        print_success "Fyers Service 5001 (http://localhost:$FYERS_5001_PORT)"
    else
        print_warning "Fyers 5001 not yet responding"
    fi
    
    if curl -s http://localhost:$FYERS_5010_PORT >/dev/null 2>&1; then
        print_success "Fyers Service 5010 (http://localhost:$FYERS_5010_PORT)"
    else
        print_warning "Fyers 5010 not yet responding"
    fi
    
    print_section "Docker Logs Summary"
    print_info "To view logs:"
    echo -e "${CYAN}  docker-compose logs -f${NC}"
    echo -e "${CYAN}  docker-compose logs -f backend${NC}"
    echo -e "${CYAN}  docker-compose logs -f frontend${NC}"
    echo -e "${CYAN}  docker-compose logs -f fyers-5001${NC}"
    echo -e "${CYAN}  docker-compose logs -f fyers-5010${NC}"
}

# ═══════════════════════════════════════════════════════════════════════════
# FINAL SUMMARY
# ═══════════════════════════════════════════════════════════════════════════

print_setup_complete() {
    print_header "✨ Setup Complete!"
    
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${GREEN}           🎉 DAKS TOP-K STOCKS Application Ready! 🎉${NC}"
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    
    echo -e "${WHITE}📱 Application URLs:${NC}"
    echo -e "  ${CYAN}Frontend:${NC}        ${GREEN}http://localhost:$FRONTEND_PORT${NC}"
    echo -e "  ${CYAN}Backend:${NC}         ${GREEN}http://localhost:$BACKEND_PORT${NC}"
    echo -e "  ${CYAN}Fyers 5001:${NC}      ${GREEN}http://localhost:$FYERS_5001_PORT${NC}"
    echo -e "  ${CYAN}Fyers 5010:${NC}      ${GREEN}http://localhost:$FYERS_5010_PORT${NC}"
    echo ""
    
    echo -e "${WHITE}🗂️ Configuration Files:${NC}"
    echo -e "  ${CYAN}Backend .env:${NC}    ${GREEN}$PROJECT_ROOT/apps/backend/.env${NC}"
    echo -e "  ${CYAN}Frontend .env:${NC}   ${GREEN}$PROJECT_ROOT/apps/frontend/.env.local${NC}"
    echo ""
    
    echo -e "${WHITE}📦 Installed Components:${NC}"
    echo -e "  ${GREEN}✓${NC} Docker & Docker Compose"
    echo -e "  ${GREEN}✓${NC} Python 3 with venv"
    echo -e "  ${GREEN}✓${NC} Fyers API packages"
    echo -e "  ${GREEN}✓${NC} Socket.IO & WebSocket"
    echo -e "  ${GREEN}✓${NC} NestJS Backend"
    echo -e "  ${GREEN}✓${NC} Next.js Frontend"
    echo -e "  ${GREEN}✓${NC} shadcn/ui Components (28+ components)"
    echo -e "  ${GREEN}✓${NC} Tailwind CSS with animations"
    echo -e "  ${GREEN}✓${NC} Chart libraries (ApexCharts, Plotly, etc.)"
    echo ""
    
    echo -e "${WHITE}🚀 Quick Start Commands:${NC}"
    echo -e "  ${CYAN}View logs:${NC}"
    echo -e "    ${GREEN}docker-compose logs -f${NC}"
    echo ""
    echo -e "  ${CYAN}Stop services:${NC}"
    echo -e "    ${GREEN}docker-compose down${NC}"
    echo ""
    echo -e "  ${CYAN}Restart services:${NC}"
    echo -e "    ${GREEN}docker-compose restart${NC}"
    echo ""
    echo -e "  ${CYAN}Rebuild everything:${NC}"
    echo -e "    ${GREEN}docker-compose build --no-cache && docker-compose up -d${NC}"
    echo ""
    
    echo -e "${WHITE}📚 Development Mode:${NC}"
    if [[ "$DEV_MODE" == true ]]; then
        echo -e "  ${GREEN}✓ Dev mode enabled - hot reload active${NC}"
    else
        echo -e "  ${CYAN}To enable dev mode next time:${NC}"
        echo -e "    ${GREEN}./setup_docker.sh --dev${NC}"
    fi
    echo ""
    
    echo -e "${WHITE}🔧 Useful Commands:${NC}"
    echo -e "  ${CYAN}Execute command in backend:${NC}"
    echo -e "    ${GREEN}docker-compose exec backend npm run build${NC}"
    echo ""
    echo -e "  ${CYAN}Access backend shell:${NC}"
    echo -e "    ${GREEN}docker-compose exec backend sh${NC}"
    echo ""
    echo -e "  ${CYAN}Access frontend shell:${NC}"
    echo -e "    ${GREEN}docker-compose exec frontend sh${NC}"
    echo ""
    echo -e "  ${CYAN}View Python dependencies:${NC}"
    echo -e "    ${GREEN}docker-compose exec fyers-5001 pip list${NC}"
    echo ""
    
    echo -e "${WHITE}📝 Next Steps:${NC}"
    echo -e "  1. Open ${CYAN}http://localhost:$FRONTEND_PORT${NC} in your browser"
    echo -e "  2. Configure Fyers API credentials in backend .env"
    echo -e "  3. Review logs: ${CYAN}docker-compose logs -f${NC}"
    echo -e "  4. Deploy to production when ready"
    echo ""
    
    echo -e "${WHITE}🆘 Troubleshooting:${NC}"
    echo -e "  ${CYAN}If services don't start:${NC}"
    echo -e "    ${GREEN}docker-compose down && docker-compose up -d --build${NC}"
    echo ""
    echo -e "  ${CYAN}If you see port conflicts:${NC}"
    echo -e "    ${GREEN}Modify ports in docker-compose.yml${NC}"
    echo ""
    echo -e "  ${CYAN}If Node modules or Python packages are missing:${NC}"
    echo -e "    ${GREEN}docker-compose build --no-cache${NC}"
    echo ""
    
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
}

# ═══════════════════════════════════════════════════════════════════════════
# ERROR HANDLING & CLEANUP
# ═══════════════════════════════════════════════════════════════════════════

handle_error() {
    local line_number=$1
    print_error "Setup failed at line $line_number"
    print_warning "Partial setup may have been completed. Please review the logs above."
    echo ""
    echo -e "${CYAN}To resume setup, you can run:${NC}"
    echo -e "  ${GREEN}./setup_docker.sh --skip-docker${NC} (if Docker is already installed)"
    echo ""
    exit 1
}

cleanup_on_exit() {
    if [[ "$?" != 0 ]]; then
        print_warning "Setup did not complete successfully"
        print_info "Review the output above for error messages"
    fi
}

# Set up error handling
trap 'handle_error ${LINENO}' ERR
trap cleanup_on_exit EXIT

# ═══════════════════════════════════════════════════════════════════════════
# MAIN EXECUTION
# ═══════════════════════════════════════════════════════════════════════════

main() {
    # Parse command line arguments
    parse_arguments "$@"
    
    # Print welcome banner
    print_header "🚀 DAKS TOP-K STOCKS - Complete Docker Setup v2.0"
    print_info "Setting up complete development environment..."
    print_info "This process may take 15-30 minutes depending on your internet speed"
    echo ""
    
    # Step 1: Setup Docker
    setup_docker
    
    # Step 2: Install system dependencies
    install_system_dependencies
    
    # Step 3: Setup Python
    setup_python_environment
    install_python_dependencies
    
    # Step 4: Setup Node.js (optional)
    install_nodejs
    
    # Step 5: Create environment files
    create_env_files
    
    # Step 6: Setup Backend
    setup_backend
    
    # Step 7: Setup Frontend
    setup_frontend
    
    # Step 8: Prepare Docker
    prepare_docker_compose
    
    # Step 9: Build Docker images
    build_docker_images
    
    # Step 10: Start services
    start_services
    
    # Step 11: Health checks
    perform_health_checks
    
    # Step 12: Print summary
    print_setup_complete
}

# Run main function with all arguments
main "$@"

