#!/bin/bash

# Apply MCP Key Migration
# This script updates the api_credentials table to support mcp_key credential type

echo "🔧 Applying MCP key migration..."

# Check if running in Docker or local
if [ -n "$POSTGRES_HOST" ]; then
  # Running in Docker/production
  PGPASSWORD=$POSTGRES_PASSWORD psql -h $POSTGRES_HOST -U $POSTGRES_USER -d $POSTGRES_DB -f migrations/004_add_mcp_key_type.sql
else
  # Running locally - use docker
  docker exec -i skaftin-postgres-local psql -U postgres -d skaftin_db << 'EOF'
ALTER TABLE public.api_credentials 
DROP CONSTRAINT IF EXISTS api_credentials_credential_type_check;

ALTER TABLE public.api_credentials 
ADD CONSTRAINT api_credentials_credential_type_check 
CHECK (credential_type IN ('api_key', 'access_token', 'mcp_key'));

SELECT conname, pg_get_constraintdef(oid) 
FROM pg_constraint 
WHERE conrelid = 'public.api_credentials'::regclass 
  AND conname = 'api_credentials_credential_type_check';
EOF
fi

if [ $? -eq 0 ]; then
  echo "✅ Migration applied successfully!"
  echo ""
  echo "You can now:"
  echo "  - Generate MCP keys in the Credentials tab"
  echo "  - Connect MCP tools to your projects"
else
  echo "❌ Migration failed. Please run manually:"
  echo ""
  echo "Run this SQL in your database:"
  cat QUICK_FIX_MCP_KEY.sql
fi

