#!/bin/bash

# Test script for unified Docker container
echo "Testing unified Docker container..."

# Run the container in background
echo "Starting container..."
docker run -d --name skaftin-test \
  -p 3005:3005 \
  -p 4005:4005 \
  -e NODE_ENV=development \
  -e JWT_SECRET=test-jwt-secret-for-development \
  skaftin-unified-fixed

# Wait for container to start
echo "Waiting for container to start..."
sleep 10

# Check if container is running
if docker ps | grep -q skaftin-test; then
    echo "✅ Container is running"
    
    # Check backend health
    echo "Testing backend health..."
    if curl -f http://localhost:4005/api/health 2>/dev/null; then
        echo "✅ Backend is healthy"
    else
        echo "❌ Backend health check failed"
    fi
    
    # Check frontend
    echo "Testing frontend..."
    if curl -f http://localhost:3005 2>/dev/null; then
        echo "✅ Frontend is accessible"
    else
        echo "❌ Frontend is not accessible"
    fi
    
    # Show logs
    echo "Container logs:"
    docker logs skaftin-test --tail 20
    
else
    echo "❌ Container failed to start"
    echo "Container logs:"
    docker logs skaftin-test
fi

# Cleanup
echo "Cleaning up..."
docker stop skaftin-test
docker rm skaftin-test

echo "Test completed!"
