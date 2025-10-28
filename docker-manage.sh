#!/bin/bash

# Skaftin Platform Docker Compose Management Script

case "$1" in
    "build")
        echo "Building Skaftin backend service..."
        docker-compose build
        ;;
    "up")
        echo "Starting Skaftin services..."
        docker-compose up -d
        ;;
    "down")
        echo "Stopping Skaftin services..."
        docker-compose down
        ;;
    "logs")
        echo "Showing logs for Skaftin services..."
        docker-compose logs -f
        ;;
    "restart")
        echo "Restarting Skaftin services..."
        docker-compose restart
        ;;
    "status")
        echo "Checking status of Skaftin services..."
        docker-compose ps
        echo ""
        echo "Service URLs:"
        echo "  Frontend: http://localhost:3006"
        echo "  Backend:  http://localhost:4006"
        ;;
    "dev")
        echo "Starting Skaftin services in development mode..."
        docker-compose up --build
        ;;
    *)
        echo "Usage: $0 {build|up|down|logs|restart|status|dev}"
        echo ""
        echo "Commands:"
        echo "  build   - Build the Docker images"
        echo "  up      - Start services in detached mode"
        echo "  down    - Stop and remove services"
        echo "  logs    - Show logs from all services"
        echo "  restart - Restart all services"
        echo "  status  - Show status of all services"
        echo "  dev     - Start services in development mode (with logs)"
        exit 1
        ;;
esac
