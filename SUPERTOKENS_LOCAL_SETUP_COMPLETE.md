# SuperTokens Local Setup - Complete ✅

## Summary

Your local SuperTokens environment is now fully operational and successfully tested!

## 🎯 What's Running

### Docker Containers
```bash
✅ skaftin-postgres-local   - PostgreSQL 17 on port 5440
✅ skaftin-supertokens      - SuperTokens Core v10.0.4 on port 3567
✅ skaftin-minio-local      - MinIO Storage on ports 9020/9021
```

### Backend Server
```bash
✅ Skaftin Backend          - Running on port 4006
✅ SuperTokens Integration  - Fully functional
✅ Auth Endpoints           - /auth/signup, /auth/signin working
✅ SuperTokens Dashboard    - http://localhost:4006/auth/dashboard/
```

## 🧪 Test Results

### User Creation Test
```bash
# Signup Test - SUCCESS ✅
User ID: dc135033-484e-4822-a276-950cbf7d9e7f
Email: test@example.com
Status: Account created successfully
Tokens: Access & Refresh tokens issued
```

### Database Verification
```bash
# Users in Database
1. sibiya.bobo@gmail.com (existing user)
2. test@example.com (test user)

# SuperTokens Schema
40 tables created in 'supertokens' schema
All authentication data properly stored
```

## 📋 Current Configuration (.env)

```bash
# Backend
BACKEND_PORT=4006
FRONTEND_URL=http://localhost:3005

# SuperTokens (Local)
SUPERTOKENS_CONNECTION_URI=http://localhost:3567
SUPERTOKENS_API_KEY=your-api-key-change-in-production
SUPERTOKENS_APP_NAME=Skaftin
SUPERTOKENS_API_DOMAIN=http://localhost:4006
SUPERTOKENS_WEBSITE_DOMAIN=http://localhost:3005

# Database (Local)
DB_HOST=localhost
DB_PORT=5440
DB_USER=postgres
DB_PASSWORD="BLUcabish#25"
DB_NAME=skaftin_db
```

## 🚀 How to Use

### Start the Environment
```bash
# Start Docker containers
docker-compose up -d

# Start backend
npm run dev:backend

# Start frontend
npm run dev:frontend
```

### Test Authentication
```bash
# Sign up
curl -X POST http://localhost:4006/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "formFields": [
      {"id": "email", "value": "user@example.com"},
      {"id": "password", "value": "Password123"}
    ]
  }'

# Sign in
curl -X POST http://localhost:4006/auth/signin \
  -H "Content-Type: application/json" \
  -d '{
    "formFields": [
      {"id": "email", "value": "user@example.com"},
      {"id": "password", "value": "Password123"}
    ]
  }'
```

### Access SuperTokens Dashboard
```bash
# Web browser
http://localhost:4006/auth/dashboard/

# Login with API key: your-api-key-change-in-production
```

## 🌐 Connecting to Coolify Production

### Coolify SuperTokens Details
```bash
Service URL: http://supertokens.bobosoftware.co.za
Port: 3567 (exposed publicly)
Database: PostgreSQL (internal, not exposed)
```

### Production .env Configuration
```bash
# SuperTokens (Production)
SUPERTOKENS_CONNECTION_URI=http://supertokens.bobosoftware.co.za
SUPERTOKENS_API_KEY=  # Set this in Coolify if needed
SUPERTOKENS_APP_NAME=Skaftin
SUPERTOKENS_API_DOMAIN=https://your-backend-domain.com  # Update to production
SUPERTOKENS_WEBSITE_DOMAIN=https://your-frontend-domain.com  # Update to production
```

### Important Security Notes

#### ✅ DO
- Connect to SuperTokens HTTP endpoint (port 3567)
- Keep database internal to Coolify (not publicly accessible)
- Set API keys for production use
- Use HTTPS in production

#### ❌ DON'T
- Expose PostgreSQL database publicly
- Share database credentials
- Use HTTP in production
- Hardcode credentials in code

### Production Deployment Steps

1. **Update Coolify SuperTokens API Key** (optional but recommended)
   ```bash
   # In Coolify, set environment variable:
   API_KEYS=your-secure-production-api-key
   ```

2. **Update Backend .env**
   ```bash
   SUPERTOKENS_CONNECTION_URI=http://supertokens.bobosoftware.co.za
   SUPERTOKENS_API_KEY=your-secure-production-api-key
   SUPERTOKENS_API_DOMAIN=https://api.bobosoftware.co.za
   SUPERTOKENS_WEBSITE_DOMAIN=https://bobosoftware.co.za
   ```

3. **Deploy Backend**
   ```bash
   # Your backend will connect to Coolify SuperTokens
   # No database setup needed - SuperTokens manages it internally
   ```

4. **Test Production Connection**
   ```bash
   curl -X POST https://api.bobosoftware.co.za/auth/signup \
     -H "Content-Type: application/json" \
     -d '{
       "formFields": [
         {"id": "email", "value": "test@example.com"},
         {"id": "password", "value": "TestPassword123"}
       ]
     }'
   ```

## 🔧 Troubleshooting

### SuperTokens Not Responding
```bash
# Check container status
docker ps | grep supertokens

# Check logs
docker logs skaftin-supertokens

# Restart container
docker restart skaftin-supertokens
```

### Database Connection Issues
```bash
# Check PostgreSQL
docker exec skaftin-postgres-local psql -U postgres -d skaftin_db -c "SELECT 1;"

# Verify schema exists
docker exec skaftin-postgres-local psql -U postgres -d skaftin_db -c "\dn"
```

### Backend Connection Errors
```bash
# Verify SuperTokens is accessible
curl http://localhost:3567/hello

# Check backend logs
tail -f backend.log

# Restart backend
npm run dev:backend
```

## 📊 Architecture

```
┌─────────────────────────────────────────────────────┐
│                 Local Development                    │
├─────────────────────────────────────────────────────┤
│                                                      │
│  Frontend (3005)  ──→  Backend (4006)               │
│                           │                          │
│                           ├──→ SuperTokens (3567)   │
│                           │     │                    │
│                           │     └──→ PostgreSQL     │
│                           │          (5440)          │
│                           │                          │
│                           └──→ MinIO (9020)         │
│                                                      │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│               Production (Coolify)                   │
├─────────────────────────────────────────────────────┤
│                                                      │
│  Frontend  ──→  Backend                             │
│                    │                                 │
│                    ├──→ supertokens.bobosoftware... │
│                    │     │                           │
│                    │     └──→ PostgreSQL (Internal) │
│                    │                                 │
│                    └──→ MinIO                        │
│                                                      │
└─────────────────────────────────────────────────────┘
```

## 🎉 Next Steps

1. ✅ Local SuperTokens setup complete
2. ⬜ Update frontend to use SuperTokens authentication
3. ⬜ Implement user session management
4. ⬜ Add role-based access control (RBAC)
5. ⬜ Deploy to production with Coolify connection

---

**Status**: Local setup tested and verified working ✅  
**Date**: November 2, 2025  
**SuperTokens Version**: 10.0.4  
**PostgreSQL Version**: 17-alpine

