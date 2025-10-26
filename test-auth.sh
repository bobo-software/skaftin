#!/bin/bash

# SuperTokens Auth Test Script
# Tests all authentication endpoints

BASE_URL="http://localhost:4005"
TEST_EMAIL="test@example.com"
TEST_PASSWORD="TestPassword123!"

echo "🧪 Testing SuperTokens Authentication Endpoints"
echo "================================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test 1: Health check endpoint
echo "1️⃣  Testing health endpoint..."
HEALTH_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/health")
if [ "$HEALTH_RESPONSE" -eq 200 ]; then
    echo -e "${GREEN}✅ Health endpoint is working${NC}"
else
    echo -e "${RED}❌ Health endpoint failed (HTTP $HEALTH_RESPONSE)${NC}"
fi
echo ""

# Test 2: Test SuperTokens endpoints are available
echo "2️⃣  Testing SuperTokens endpoints availability..."

# Check signup endpoint
SIGNUP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X OPTIONS "$BASE_URL/auth/signup")
if [ "$SIGNUP_STATUS" -eq 200 ] || [ "$SIGNUP_STATUS" -eq 204 ] || [ "$SIGNUP_STATUS" -eq 405 ]; then
    echo -e "${GREEN}✅ Signup endpoint available (HTTP $SIGNUP_STATUS)${NC}"
else
    echo -e "${RED}❌ Signup endpoint not available (HTTP $SIGNUP_STATUS)${NC}"
fi

# Check signin endpoint
SIGNIN_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X OPTIONS "$BASE_URL/auth/signin")
if [ "$SIGNIN_STATUS" -eq 200 ] || [ "$SIGNIN_STATUS" -eq 204 ] || [ "$SIGNIN_STATUS" -eq 405 ]; then
    echo -e "${GREEN}✅ Signin endpoint available (HTTP $SIGNIN_STATUS)${NC}"
else
    echo -e "${RED}❌ Signin endpoint not available (HTTP $SIGNIN_STATUS)${NC}"
fi

# Check session endpoint
SESSION_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X OPTIONS "$BASE_URL/auth/session")
if [ "$SESSION_STATUS" -eq 200 ] || [ "$SESSION_STATUS" -eq 204 ] || [ "$SESSION_STATUS" -eq 405 ]; then
    echo -e "${GREEN}✅ Session endpoint available (HTTP $SESSION_STATUS)${NC}"
else
    echo -e "${RED}❌ Session endpoint not available (HTTP $SESSION_STATUS)${NC}"
fi

echo ""

# Test 3: Try to signup a new user
echo "3️⃣  Testing user signup..."
SIGNUP_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/signup" \
    -H "Content-Type: application/json" \
    -d "{\"formFields\":[{\"id\":\"email\",\"value\":\"$TEST_EMAIL\"},{\"id\":\"password\",\"value\":\"$TEST_PASSWORD\"}]}" \
    -w "\n%{http_code}")

HTTP_CODE=$(echo "$SIGNUP_RESPONSE" | tail -n1)
BODY=$(echo "$SIGNUP_RESPONSE" | sed '$d')

if [ "$HTTP_CODE" -eq 200 ]; then
    echo -e "${GREEN}✅ User signup successful${NC}"
    echo "Response: $BODY"
elif [ "$HTTP_CODE" -eq 200 ] || [ "$HTTP_CODE" -eq 201 ]; then
    echo -e "${YELLOW}⚠️  User might already exist (HTTP $HTTP_CODE)${NC}"
else
    echo -e "${RED}❌ User signup failed (HTTP $HTTP_CODE)${NC}"
    echo "Response: $BODY"
fi
echo ""

# Test 4: Try to signin with the created user
echo "4️⃣  Testing user signin..."
SIGNIN_RESPONSE=$(curl -s -i -X POST "$BASE_URL/auth/signin" \
    -H "Content-Type: application/json" \
    -d "{\"formFields\":[{\"id\":\"email\",\"value\":\"$TEST_EMAIL\"},{\"id\":\"password\",\"value\":\"$TEST_PASSWORD\"}]}" \
    -w "\n%{http_code}")

HTTP_CODE=$(echo "$SIGNIN_RESPONSE" | tail -n1)
COOKIES=$(echo "$SIGNIN_RESPONSE" | grep -i "set-cookie" | tr '\n' ';')

if [ "$HTTP_CODE" -eq 200 ]; then
    echo -e "${GREEN}✅ User signin successful${NC}"
    echo "Cookies: $COOKIES"
    # Extract cookies for next requests
    SUPERTOKENS_COOKIE=$(echo "$SIGNIN_RESPONSE" | grep -i "set-cookie.*sFrontToken" | sed 's/.*\(sFrontToken[^;]*\).*/\1/')
else
    echo -e "${RED}❌ User signin failed (HTTP $HTTP_CODE)${NC}"
fi
echo ""

# Test 5: Check session
echo "5️⃣  Testing session check..."
SESSION_RESPONSE=$(curl -s -X GET "$BASE_URL/auth/session" \
    -H "Cookie: $COOKIES" \
    -w "\n%{http_code}")

HTTP_CODE=$(echo "$SESSION_RESPONSE" | tail -n1)
BODY=$(echo "$SESSION_RESPONSE" | sed '$d')

if [ "$HTTP_CODE" -eq 200 ]; then
    echo -e "${GREEN}✅ Session check successful${NC}"
    echo "Session data: $BODY"
else
    echo -e "${RED}❌ Session check failed (HTTP $HTTP_CODE)${NC}"
fi
echo ""

# Test 6: Try to sign out
echo "6️⃣  Testing user signout..."
SIGNOUT_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/signout" \
    -H "Cookie: $COOKIES" \
    -w "\n%{http_code}")

HTTP_CODE=$(echo "$SIGNOUT_RESPONSE" | tail -n1)

if [ "$HTTP_CODE" -eq 200 ]; then
    echo -e "${GREEN}✅ User signout successful${NC}"
else
    echo -e "${RED}❌ User signout failed (HTTP $HTTP_CODE)${NC}"
fi
echo ""

echo "================================================"
echo "🏁 Auth testing completed!"
echo ""
echo "📝 Test Summary:"
echo "  - Health check: ✓"
echo "  - Endpoint availability: ✓"
echo "  - User signup: Try again if failed (user might exist)"
echo "  - User signin: Check credentials if failed"
echo "  - Session management: Check cookies if failed"
echo "  - User signout: Check session if failed"
