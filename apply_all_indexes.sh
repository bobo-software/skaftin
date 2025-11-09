#!/bin/bash

# Apply All Performance Indexes
# This script applies indexes to both system tables and project schema

echo "🚀 Applying performance indexes to Skaftin database..."
echo ""

# Apply system table indexes
echo "📊 Step 1: Adding indexes to system tables (organizations, projects, etc.)..."
docker exec -i skaftin-postgres-local psql -U postgres -d skaftin_db < migrations/005_add_performance_indexes.sql

if [ $? -eq 0 ]; then
  echo "✅ System table indexes applied successfully!"
else
  echo "❌ Failed to apply system table indexes"
  exit 1
fi

echo ""

# Apply project schema indexes
echo "📊 Step 2: Adding indexes to project schema (associations, drivers, vehicles)..."
docker exec -i skaftin-postgres-local psql -U postgres -d skaftin_db < apply_project_indexes.sql

if [ $? -eq 0 ]; then
  echo "✅ Project schema indexes applied successfully!"
else
  echo "❌ Failed to apply project schema indexes"
  exit 1
fi

echo ""
echo "🎉 All indexes applied successfully!"
echo ""
echo "📈 Performance improvements:"
echo "  ✅ Faster multi-tenant filtering (association_id)"
echo "  ✅ Faster JOIN operations (foreign keys)"
echo "  ✅ Faster status filtering (status columns)"
echo "  ✅ Optimized timestamp queries (created_at)"
echo ""
echo "💡 Your queries should now run significantly faster!"

