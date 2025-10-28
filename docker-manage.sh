#!/bin/bash

# Skaftin Docker Management Script
# This script helps you switch between separate services and unified Docker setup

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_header() {
    echo -e "${BLUE}=== $1 ===${NC}"
}

# Function to show usage
show_usage() {
    echo "Usage: $0 [COMMAND]"
    echo ""
    echo "Commands:"
    echo "  unified     - Use unified Docker setup (single container)"
    echo "  separate    - Use separate Docker setup (frontend + backend containers)"
    echo "  build       - Build unified Docker image"
    echo "  up          - Start unified services (development)"
    echo "  up-prod     - Start production services (from registry)"
    echo "  down        - Stop all services"
    echo "  logs        - Show logs from unified container"
    echo "  status      - Show running containers"
    echo "  help        - Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 unified    # Switch to unified setup"
    echo "  $0 build      # Build the unified image"
    echo "  $0 up         # Start unified services (dev)"
    echo "  $0 up-prod    # Start production services"
}

# Function to switch to unified setup
switch_to_unified() {
    print_header "Switching to Unified Docker Setup"
    
    if [ -f "docker-compose.unified.yml" ]; then
        print_status "Found unified docker-compose file"
        
        # Create symlink or copy
        if [ -L "docker-compose.yml" ]; then
            rm docker-compose.yml
        fi
        
        cp docker-compose.unified.yml docker-compose.yml
        print_status "Switched to unified setup"
        print_warning "Run 'docker-compose down' then 'docker-compose up' to apply changes"
    else
        print_error "docker-compose.unified.yml not found!"
        exit 1
    fi
}

# Function to switch to separate setup
switch_to_separate() {
    print_header "Switching to Separate Docker Setup"
    
    if [ -f "docker-compose.yml" ]; then
        # Backup current unified setup
        cp docker-compose.yml docker-compose.unified.yml.backup
        
        # Restore original separate setup (you'll need to create this)
        print_warning "Please restore your original docker-compose.yml for separate setup"
        print_status "Current unified setup backed up as docker-compose.unified.yml.backup"
    else
        print_error "docker-compose.yml not found!"
        exit 1
    fi
}

# Function to build unified image
build_unified() {
    print_header "Building Unified Docker Image"
    
    if [ -f "Dockerfile.unified" ]; then
        print_status "Building unified image..."
        docker build -f Dockerfile.unified -t skaftin-unified .
        print_status "Unified image built successfully!"
    else
        print_error "Dockerfile.unified not found!"
        exit 1
    fi
}

# Function to start unified services
start_unified() {
    print_header "Starting Unified Services"
    
    if [ -f "docker-compose.unified.yml" ]; then
        print_status "Starting unified services..."
        docker-compose -f docker-compose.unified.yml up -d
        print_status "Services started!"
        print_status "Frontend: http://localhost:3005"
        print_status "Backend API: http://localhost:4005"
    else
        print_error "docker-compose.unified.yml not found!"
        exit 1
    fi
}

# Function to start production services
start_production() {
    print_header "Starting Production Services"
    
    if [ -f "docker-compose.production.yml" ]; then
        print_status "Starting production services from registry..."
        docker-compose -f docker-compose.production.yml up -d
        print_status "Production services started!"
        print_status "Frontend: http://localhost:3005"
        print_status "Backend API: http://localhost:4005"
        print_warning "Make sure you have the latest image: docker pull dr.bobosoftware.co.za/skaftin-app:latest"
    else
        print_error "docker-compose.production.yml not found!"
        exit 1
    fi
}

# Function to stop all services
stop_all() {
    print_header "Stopping All Services"
    
    print_status "Stopping unified services..."
    docker-compose -f docker-compose.unified.yml down 2>/dev/null || true
    
    print_status "Stopping production services..."
    docker-compose -f docker-compose.production.yml down 2>/dev/null || true
    
    print_status "Stopping separate services..."
    docker-compose down 2>/dev/null || true
    
    print_status "All services stopped!"
}

# Function to show logs
show_logs() {
    print_header "Showing Unified Container Logs"
    
    docker-compose -f docker-compose.unified.yml logs -f skaftin-app
}

# Function to show status
show_status() {
    print_header "Container Status"
    
    echo "Unified Services:"
    docker-compose -f docker-compose.unified.yml ps 2>/dev/null || echo "No unified services running"
    
    echo ""
    echo "All Running Containers:"
    docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
}

# Main script logic
case "${1:-help}" in
    "unified")
        switch_to_unified
        ;;
    "separate")
        switch_to_separate
        ;;
    "build")
        build_unified
        ;;
    "up")
        start_unified
        ;;
    "up-prod")
        start_production
        ;;
    "down")
        stop_all
        ;;
    "logs")
        show_logs
        ;;
    "status")
        show_status
        ;;
    "help"|*)
        show_usage
        ;;
esac
