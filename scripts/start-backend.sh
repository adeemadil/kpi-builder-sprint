#!/bin/bash

set -euo pipefail

echo "🚀 Starting KPI Builder Backend Server"
echo "======================================"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
BACKEND_DIR="backend"
DATA_DIR="$BACKEND_DIR/data"
DB_FILE="$DATA_DIR/kpi_builder.sqlite"
SEED_SCRIPT="$DATA_DIR/seed_sqlite.py"

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
    if [[ ! -d "$BACKEND_DIR" ]]; then
        log_error "Backend directory not found. Please run this script from the project root."
        exit 1
    fi
}

# Check if database exists and is seeded
check_database() {
    if [[ ! -f "$DB_FILE" ]]; then
        log_warning "Database not found. Seeding database..."
        
        # Check if Python and pandas are available
        if ! command -v python3 >/dev/null 2>&1; then
            log_error "Python 3 is required for database seeding."
            exit 1
        fi
        
        if ! python3 -c "import pandas" 2>/dev/null; then
            log_error "pandas is required for database seeding. Install with: pip install pandas"
            exit 1
        fi
        
        # Run seeding script
        cd "$DATA_DIR"
        if python3 seed_sqlite.py; then
            log_success "Database seeded successfully"
            cd - > /dev/null
        else
            log_error "Database seeding failed"
            cd - > /dev/null
            exit 1
        fi
    else
        log_success "Database found"
    fi
}

# Check if Node.js dependencies are installed
check_dependencies() {
    if [[ ! -d "$BACKEND_DIR/node_modules" ]]; then
        log_warning "Node.js dependencies not found. Installing..."
        cd "$BACKEND_DIR"
        npm install
        cd - > /dev/null
        log_success "Dependencies installed"
    else
        log_success "Dependencies found"
    fi
}

# Start the backend server
start_server() {
    log_info "Starting backend server..."
    cd "$BACKEND_DIR"
    
    # Check if port 3001 is already in use
    if lsof -Pi :3001 -sTCP:LISTEN -t >/dev/null 2>&1; then
        log_warning "Port 3001 is already in use. Trying to kill existing process..."
        pkill -f "node.*server" || true
        sleep 2
    fi
    
    # Start the development server
    log_info "Starting server on http://localhost:3001"
    echo ""
    log_info "Available endpoints:"
    echo "  - Health: http://localhost:3001/api/health"
    echo "  - Detections: POST http://localhost:3001/api/detections"
    echo "  - Aggregate: POST http://localhost:3001/api/aggregate"
    echo "  - Close Calls: POST http://localhost:3001/api/close-calls"
    echo "  - Vest Violations: GET http://localhost:3001/api/vest-violations"
    echo "  - Overspeed: GET http://localhost:3001/api/overspeed"
    echo ""
    echo "Press Ctrl+C to stop the server"
    echo ""
    echo "📝 Useful Commands:"
    echo "  Run tests: cd backend && npm test"
    echo "  Test coverage: cd backend && npm run test:coverage"
    echo ""
    
    npm run dev
}

# Main execution
main() {
    check_directory
    check_database
    check_dependencies
    start_server
}

# Run main function
main "$@"
