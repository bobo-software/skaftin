#!/bin/bash

# Docker Local Development Management Script for Skaftin

case "$1" in
    "start")
        echo "Starting local PostgreSQL and MinIO services..."
        docker-compose -f docker-compose.local.yml up -d
        echo ""
        echo "Services started successfully!"
        echo "PostgreSQL: localhost:5440"
        echo "MinIO API: localhost:9000"
        echo "MinIO Console: http://localhost:9001"
        echo ""
        echo "Credentials:"
        echo "PostgreSQL - User: skaftin_user, Password: skaftin_password, DB: skaftin_db"
        echo "MinIO - User: skaftin_minio, Password: skaftin_password"
        ;;
    "stop")
        echo "Stopping local services..."
        docker-compose -f docker-compose.local.yml down
        echo "Services stopped."
        ;;
    "restart")
        echo "Restarting local services..."
        docker-compose -f docker-compose.local.yml down
        docker-compose -f docker-compose.local.yml up -d
        echo "Services restarted."
        ;;
    "logs")
        echo "Showing logs for local services..."
        docker-compose -f docker-compose.local.yml logs -f
        ;;
    "status")
        echo "Checking status of local services..."
        docker-compose -f docker-compose.local.yml ps
        ;;
    "clean")
        echo "Cleaning up local services and volumes..."
        docker-compose -f docker-compose.local.yml down -v
        echo "Cleanup completed."
        ;;
    *)
        echo "Usage: $0 {start|stop|restart|logs|status|clean}"
        echo ""
        echo "Commands:"
        echo "  start   - Start PostgreSQL and MinIO services"
        echo "  stop    - Stop all services"
        echo "  restart - Restart all services"
        echo "  logs    - Show logs for all services"
        echo "  status  - Show status of all services"
        echo "  clean   - Stop services and remove volumes (WARNING: deletes data)"
        exit 1
        ;;
esac
