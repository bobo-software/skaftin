# Production Environment Variables Template

Use these values when deploying to Coolify/Production.

## Copy this to your Coolify environment variables:

```bash
# PORT CONNECTION
FRONTEND_PORT=3006
FRONTEND_URL=https://bobosoftware.co.za
BACKEND_PORT=4006

# DATABASE CONNECTION (Production - Coolify/Cloud)
DB_CONNECTION=postgresql
DB_HOST=your-production-db-host
DB_PORT=5432
DB_USER=your-production-db-user
DB_PASSWORD=your-production-db-password
DB_NAME=skaftin_db

# JWT Secret for authentication (legacy - will be replaced by SuperTokens)
JWT_SECRET=your-production-jwt-secret-here

# SuperTokens Configuration (PRODUCTION - Coolify)
SUPERTOKENS_CONNECTION_URI=http://supertokens.bobosoftware.co.za
SUPERTOKENS_API_KEY=  # Optional: Set this if you configure API_KEYS in Coolify SuperTokens
SUPERTOKENS_APP_NAME=Skaftin
SUPERTOKENS_API_DOMAIN=https://api.bobosoftware.co.za
SUPERTOKENS_WEBSITE_DOMAIN=https://bobosoftware.co.za

# EMAIL CONNECTION
EMAIL_PASS=your-production-email-password
EMAIL_USER=your-production-email@example.com

# PRODUCTION MINIO CONNECTION (Cloud/Coolify)
MINIO_ROOT_USER=your-production-minio-user
MINIO_ROOT_PASSWORD=your-production-minio-password
MINIO_ACCESS_KEY=your-production-minio-user
MINIO_SECRET_KEY=your-production-minio-password
MINIO_SERVER_URL=https://minio.bobosoftware.co.za
MINIO_ENDPOINT=minio.bobosoftware.co.za
MINIO_CONSOLE_PORT=9001
MINIO_BUCKET=skaftin
MINIO_REGION=us-east-1
MINIO_USE_SSL=true
```

## Key Changes for Production:

### SuperTokens (✅ Already configured on Coolify)
- **Connection URI**: `http://supertokens.bobosoftware.co.za`
- **API Domain**: Change to your production backend URL
- **Website Domain**: Change to your production frontend URL
- **API Key**: Optional - only if you set `API_KEYS` in Coolify SuperTokens

### Important Notes:

1. **SuperTokens Database**: 
   - You do NOT need to configure the database credentials
   - SuperTokens on Coolify has its own PostgreSQL:
     - User: `kVsCF3sSGm3M0m3s`
     - Password: `mNFzsHnJAgvQ1gJomels9YfRg0F1CdTb`
     - Database: `supertokens`
   - These are managed internally by Coolify - DO NOT expose publicly!

2. **Security**:
   - Use HTTPS for all public URLs (api, website, minio)
   - Set `MINIO_USE_SSL=true` in production
   - Generate strong secrets for JWT and other credentials

3. **Frontend Build Args**:
   - When building frontend Docker image, pass:
     ```bash
     --build-arg VITE_API_URL=https://api.bobosoftware.co.za
     ```

## To Switch Between Environments:

### Local Development
Just use the current `.env` file (already configured for local)

### Production Deployment
In Coolify, set environment variables with the production values above.

---

**Quick Reference:**
- Local SuperTokens: `http://localhost:3567`
- Production SuperTokens: `http://supertokens.bobosoftware.co.za`

