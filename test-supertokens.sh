#!/bin/bash

# SuperTokens Local Setup Verification Script
# Run this to verify your SuperTokens installation is working correctly

echo "🔍 SuperTokens Setup Verification"
echo "=================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if SuperTokens container is running
echo -n "Checking SuperTokens container... "
if docker ps | grep -q "skaftin-supertokens"; then
    echo -e "${GREEN}✓ Running${NC}"
else
    echo -e "${RED}✗ Not running${NC}"
    echo "Run: docker-compose up -d"
    exit 1
fi

# Check if PostgreSQL container is running
echo -n "Checking PostgreSQL container... "
if docker ps | grep -q "skaftin-postgres-local"; then
    echo -e "${GREEN}✓ Running${NC}"
else
    echo -e "${RED}✗ Not running${NC}"
    echo "Run: docker-compose up -d"
    exit 1
fi

# Check SuperTokens health
echo -n "Checking SuperTokens health... "
RESPONSE=$(curl -s http://localhost:3567/hello)
if [ "$RESPONSE" == "Hello" ]; then
    echo -e "${GREEN}✓ Healthy${NC}"
else
    echo -e "${RED}✗ Not responding${NC}"
    exit 1
fi

# Check backend server
echo -n "Checking backend server... "
if curl -s http://localhost:4006/ | grep -q "Skaftin Platform API"; then
    echo -e "${GREEN}✓ Running${NC}"
else
    echo -e "${YELLOW}⚠ Not running${NC}"
    echo "Start with: npm run dev:backend"
fi

# Check database connection
echo -n "Checking database connection... "
DB_CHECK=$(docker exec skaftin-postgres-local psql -U postgres -d skaftin_db -c "SELECT 1;" 2>&1)
if echo "$DB_CHECK" | grep -q "1 row"; then
    echo -e "${GREEN}✓ Connected${NC}"
else
    echo -e "${RED}✗ Connection failed${NC}"
    exit 1
fi

# Check SuperTokens schema
echo -n "Checking SuperTokens schema... "
SCHEMA_CHECK=$(docker exec skaftin-postgres-local psql -U postgres -d skaftin_db -c "SELECT COUNT(*) FROM pg_tables WHERE schemaname = 'supertokens';" 2>&1)
TABLE_COUNT=$(echo "$SCHEMA_CHECK" | grep -oP '\d+' | head -1)
if [ "$TABLE_COUNT" -gt 30 ]; then
    echo -e "${GREEN}✓ $TABLE_COUNT tables${NC}"
else
    echo -e "${RED}✗ Schema incomplete${NC}"
    exit 1
fi

# Count users
echo -n "Checking user accounts... "
USER_COUNT=$(docker exec skaftin-postgres-local psql -U postgres -d skaftin_db -t -c "SELECT COUNT(*) FROM supertokens.emailpassword_users;" 2>&1 | tr -d ' ')
if [ -n "$USER_COUNT" ] && [ "$USER_COUNT" -ge 0 ]; then
    echo -e "${GREEN}✓ $USER_COUNT users${NC}"
else
    echo -e "${YELLOW}⚠ Unable to count users${NC}"
fi

echo ""
echo "=================================="
echo -e "${GREEN}✓ All checks passed!${NC}"
echo ""
echo "📝 Quick Links:"
echo "  - SuperTokens Health: http://localhost:3567/hello"
echo "  - Backend API: http://localhost:4006/"
echo "  - SuperTokens Dashboard: http://localhost:4006/auth/dashboard/"
echo ""
echo "🧪 Test Commands:"
echo "  # Sign up a new user:"
echo "  curl -X POST http://localhost:4006/auth/signup \\"
echo "    -H 'Content-Type: application/json' \\"
echo "    -d '{\"formFields\":[{\"id\":\"email\",\"value\":\"user@example.com\"},{\"id\":\"password\",\"value\":\"Password123\"}]}'"
echo ""
echo "  # Sign in:"
echo "  curl -X POST http://localhost:4006/auth/signin \\"
echo "    -H 'Content-Type: application/json' \\"
echo "    -d '{\"formFields\":[{\"id\":\"email\",\"value\":\"user@example.com\"},{\"id\":\"password\",\"value\":\"Password123\"}]}'"
echo ""

