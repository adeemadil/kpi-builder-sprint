#!/bin/bash

set -euo pipefail

echo "🎨 Starting KPI Builder Frontend"
echo "================================"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
FRONTEND_DIR="frontend"
BACKEND_URL="http://localhost:3001"

# Function to log messages
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if we're in the right directory
check_directory() {
    if [[ ! -d "$FRONTEND_DIR" ]]; then
        log_error "Frontend directory not found. Please run this script from the project root."
        exit 1
    fi
}

# Check if backend is running
check_backend() {
    log_info "Checking if backend is running..."
    
    if curl -s "$BACKEND_URL/api/health" >/dev/null 2>&1; then
        log_success "Backend is running at $BACKEND_URL"
    else
        log_warning "Backend is not running at $BACKEND_URL"
        echo ""
        echo "Please start the backend first:"
        echo "  ./scripts/start-backend.sh"
        echo ""
        read -p "Do you want to continue anyway? (y/N): " -n 1 -r
        echo ""
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            log_info "Exiting. Start the backend first."
            exit 0
        fi
    fi
}

# Check if Node.js dependencies are installed
check_dependencies() {
    if [[ ! -d "$FRONTEND_DIR/node_modules" ]]; then
        log_warning "Node.js dependencies not found. Installing..."
        cd "$FRONTEND_DIR"
        npm install
        cd - > /dev/null
        log_success "Dependencies installed"
    else
        log_success "Dependencies found"
    fi
}

# Set environment variables
set_environment() {
    log_info "Setting up environment variables..."
    
    # Create .env file if it doesn't exist
    if [[ ! -f "$FRONTEND_DIR/.env" ]]; then
        cat > "$FRONTEND_DIR/.env" << EOF
VITE_API_URL=$BACKEND_URL
EOF
        log_success "Created .env file with API URL: $BACKEND_URL"
    else
        log_info "Environment file already exists"
    fi
}

# Start the frontend development server
start_frontend() {
    log_info "Starting frontend development server..."
    cd "$FRONTEND_DIR"
    
    # Check if port 5173 is already in use
    if lsof -Pi :5173 -sTCP:LISTEN -t >/dev/null 2>&1; then
        log_warning "Port 5173 is already in use. Trying to kill existing process..."
        pkill -f "vite" || true
        sleep 2
    fi
    
    # Start the development server
    log_info "Starting frontend on http://localhost:5173"
    echo ""
    log_info "Frontend features:"
    echo "  - Dashboard with safety analytics"
    echo "  - KPI Builder for custom metrics"
    echo "  - Interactive charts and graphs"
    echo "  - Filter and group by options"
    echo ""
    echo "Press Ctrl+C to stop the frontend"
    echo ""
    
    npm run dev
}

# Main execution
main() {
    check_directory
    check_backend
    check_dependencies
    set_environment
    start_frontend
}

# Run main function
main "$@"
