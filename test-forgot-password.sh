#!/bin/bash

# Test script for forgot password flow
# Make sure backend is running before executing this script

BASE_URL="http://localhost:4006"
API_KEY="your-api-key-here"  # Replace with actual API key
EMAIL="test@example.com"      # Replace with actual test user email

echo "🧪 Testing Forgot Password Flow"
echo "================================"
echo ""

# Step 1: Send OTP
echo "📤 Step 1: Sending OTP to $EMAIL..."
SEND_RESPONSE=$(curl -s -X POST "$BASE_URL/api/app-auth/auth/forgot-password" \
  -H "Content-Type: application/json" \
  -H "x-api-key: $API_KEY" \
  -d "{\"email\":\"$EMAIL\",\"method\":\"email\"}")

echo "Response: $SEND_RESPONSE"
echo ""

# Check if successful
if echo "$SEND_RESPONSE" | grep -q '"success":true'; then
  echo "✅ OTP sent successfully!"
  echo ""
  echo "📧 Check your email for the OTP code."
  echo ""
  echo "Enter the OTP code you received:"
  read OTP_CODE
  
  # Step 2: Verify OTP
  echo ""
  echo "🔐 Step 2: Verifying OTP code..."
  VERIFY_RESPONSE=$(curl -s -X POST "$BASE_URL/api/app-auth/auth/verify-forgot-password-otp" \
    -H "Content-Type: application/json" \
    -H "x-api-key: $API_KEY" \
    -d "{\"email\":\"$EMAIL\",\"code\":\"$OTP_CODE\"}")
  
  echo "Response: $VERIFY_RESPONSE"
  echo ""
  
  # Check if verified
  if echo "$VERIFY_RESPONSE" | grep -q '"success":true'; then
    echo "✅ OTP verified successfully!"
    
    # Extract reset token
    RESET_TOKEN=$(echo "$VERIFY_RESPONSE" | grep -o '"reset_token":"[^"]*"' | cut -d'"' -f4)
    echo "Reset token: $RESET_TOKEN"
    echo ""
    
    # Step 3: Reset Password
    echo "Enter new password (min 8 characters):"
    read -s NEW_PASSWORD
    
    echo ""
    echo "🔒 Step 3: Resetting password..."
    RESET_RESPONSE=$(curl -s -X POST "$BASE_URL/api/app-auth/auth/reset-password" \
      -H "Content-Type: application/json" \
      -H "x-api-key: $API_KEY" \
      -d "{\"email\":\"$EMAIL\",\"reset_token\":\"$RESET_TOKEN\",\"new_password\":\"$NEW_PASSWORD\"}")
    
    echo "Response: $RESET_RESPONSE"
    echo ""
    
    # Check if reset successful
    if echo "$RESET_RESPONSE" | grep -q '"success":true'; then
      echo "✅ Password reset successfully!"
      echo ""
      echo "🎉 All tests passed! You can now login with your new password."
    else
      echo "❌ Failed to reset password"
      echo "Error: $RESET_RESPONSE"
    fi
  else
    echo "❌ Failed to verify OTP"
    echo "Error: $VERIFY_RESPONSE"
  fi
else
  echo "❌ Failed to send OTP"
  echo "Error: $SEND_RESPONSE"
fi

echo ""
echo "================================"
echo "Test completed"

