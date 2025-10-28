#!/bin/bash

# Skaftin Platform Production Deployment Script
# This script handles login to private Docker registry and deployment

REGISTRY_URL="dr.bobosoftware.co.za"
BACKEND_IMAGE="skaftin-platform"
FRONTEND_IMAGE="skaftin-frontend"

case "$1" in
    "login")
        echo "Logging into private Docker registry..."
        echo "Please enter your registry credentials:"
        docker login $REGISTRY_URL
        ;;
    "pull")
        echo "Pulling latest images from registry..."
        docker pull $REGISTRY_URL/$BACKEND_IMAGE:latest
        docker pull $REGISTRY_URL/$FRONTEND_IMAGE:latest
        ;;
    "deploy")
        echo "Deploying Skaftin Platform to production..."
        
        # Login to registry
        echo "Logging into registry..."
        docker login $REGISTRY_URL
        
        # Pull latest images
        echo "Pulling latest images..."
        docker pull $REGISTRY_URL/$BACKEND_IMAGE:latest
        docker pull $REGISTRY_URL/$FRONTEND_IMAGE:latest
        
        # Stop existing services
        echo "Stopping existing services..."
        docker-compose -f docker-compose.prod.yml down
        
        # Start new services
        echo "Starting new services..."
        docker-compose -f docker-compose.prod.yml up -d
        
        # Show status
        echo "Deployment complete! Service status:"
        docker-compose -f docker-compose.prod.yml ps
        ;;
    "logs")
        echo "Showing production logs..."
        docker-compose -f docker-compose.prod.yml logs -f
        ;;
    "status")
        echo "Production service status:"
        docker-compose -f docker-compose.prod.yml ps
        ;;
    "stop")
        echo "Stopping production services..."
        docker-compose -f docker-compose.prod.yml down
        ;;
    "restart")
        echo "Restarting production services..."
        docker-compose -f docker-compose.prod.yml restart
        ;;
    *)
        echo "Usage: $0 {login|pull|deploy|logs|status|stop|restart}"
        echo ""
        echo "Commands:"
        echo "  login   - Login to private Docker registry"
        echo "  pull    - Pull latest image from registry"
        echo "  deploy  - Full deployment (login, pull, stop, start)"
        echo "  logs    - Show production logs"
        echo "  status  - Show production service status"
        echo "  stop    - Stop production services"
        echo "  restart - Restart production services"
        exit 1
        ;;
esac
