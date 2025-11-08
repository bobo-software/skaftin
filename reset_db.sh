#!/bin/bash

echo "🔄 Resetting Skaftin Database..."
echo "================================"
echo ""
echo "⚠️  WARNING: This will delete ALL data!"
echo ""
read -p "Are you sure you want to continue? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    echo "❌ Database reset cancelled."
    exit 0
fi

# Check if running in Docker or local
if docker ps | grep -q "skaftin-postgres-local"; then
    echo ""
    echo "🐳 Detected Docker container..."
    echo "🗄️  Running reset script in Docker..."
    
    # Copy SQL file to container and execute
    docker cp migrations/RESET_DATABASE.sql skaftin-postgres-local:/tmp/reset.sql
    docker exec -i skaftin-postgres-local psql -U postgres -d skaftin_db -f /tmp/reset.sql
    
    RESULT=$?
else
    echo ""
    echo "💻 Running on local PostgreSQL..."
    
    # Load from .env file if it exists
    if [ -f .env ]; then
        export $(cat .env | grep -v '^#' | grep -v '^$' | xargs)
    fi
    
    # Database connection details
    DB_HOST="${DB_HOST:-localhost}"
    DB_PORT="${DB_PORT:-5440}"
    DB_NAME="${DB_NAME:-skaftin_db}"
    DB_USER="${DB_USER:-postgres}"
    DB_PASSWORD="${DB_PASSWORD}"
    
    echo "🗄️  Running reset script..."
    
    # Run the reset SQL script
    PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f migrations/RESET_DATABASE.sql
    
    RESULT=$?
fi

if [ $RESULT -eq 0 ]; then
    echo ""
    echo "✅ Database reset successfully!"
    echo ""
    echo "📝 Next steps:"
    echo "   1. Restart your backend server"
    echo "   2. Register a new user at http://localhost:3005/login"
    echo "   3. Create an organization (auto-redirected)"
    echo "   4. Create projects within your organization"
    echo ""
    echo "🎉 Fresh start with organization feature!"
else
    echo ""
    echo "❌ Database reset failed. Check the error messages above."
    exit 1
fi
