# SuperTokens Installation Guide for Skaftin

This guide covers the complete setup of SuperTokens authentication for the Skaftin platform.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Docker Setup](#docker-setup)
3. [Backend Integration](#backend-integration)
4. [Frontend Integration](#frontend-integration)
5. [Configuration](#configuration)
6. [Testing](#testing)
7. [Troubleshooting](#troubleshooting)

---

## Prerequisites

- Docker installed on your system
- PostgreSQL running on localhost:5432
- Node.js and npm installed
- Existing Skaftin project setup

### Database Setup

Ensure your PostgreSQL is running and accessible with these credentials:
- **Host**: localhost
- **Port**: 5432
- **Database**: postgres
- **User**: postgres
- **Password**: BLUcabish#25

---

## Docker Setup

### 1. Create docker-compose.yml

Create a `docker-compose.yml` file in your project root:

```yaml
version: '3.8'

services:
  supertokens:
    image: registry.supertokens.io/supertokens/supertokens-postgresql:latest
    container_name: skaftin-supertokens
    restart: unless-stopped
    network_mode: "host"
    environment:
      POSTGRESQL_CONNECTION_URI: "postgresql://postgres:BLUcabish%2325@localhost:5432/postgres"
      API_KEYS: "dev-api-key-change-in-production"
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3567/hello"]
      interval: 10s
      timeout: 5s
      retries: 5
```

**Important Notes:**
- The `#` character in the password must be URL-encoded as `%23`
- `network_mode: "host"` is required on Linux to access localhost services
- Change the `API_KEYS` value for production deployment

### 2. Update .env File

Add these variables to your `.env` file:

```bash
# SUPERTOKENS CONNECTION
SUPERTOKENS_CONNECTION_URI=http://localhost:3567
SUPERTOKENS_API_KEY=dev-api-key-change-in-production
```

**Note**: Remove quotes from passwords in `.env` files.

### 3. Start SuperTokens

```bash
# Start SuperTokens container
docker compose up -d

# Check logs
docker compose logs -f supertokens

# Verify it's running
curl http://localhost:3567/hello
# Should return: "Hello"
```

---

## Backend Integration

### 1. Install Dependencies

```bash
cd /path/to/Skaftin
npm install supertokens-node
```

### 2. Configure SuperTokens Backend

Create or update `src/backend/config/supertokens.ts`:

```typescript
import { TypeInput } from "supertokens-node/types";
import EmailPassword from "supertokens-node/recipe/emailpassword";
import { config } from './environment';

export const SuperTokensConfig: TypeInput = {
  framework: "express",
  supertokens: {
    connectionURI: config.supertokens.connectionURI,
    apiKey: config.supertokens.apiKey,
  },
  appInfo: {
    appName: "Skaftin",
    apiDomain: config.backend.url,
    websiteDomain: config.frontend.url,
  },
  recipeList: [
    EmailPassword.init({
      emailVerificationFeature: {
        mode: "OPTIONAL",
      },
    }),
  ],
};
```

### 3. Update environment.ts

Add SuperTokens configuration to `src/backend/config/environment.ts`:

```typescript
export const config = {
  // ... existing config ...
  
  // SuperTokens Configuration
  supertokens: {
    connectionURI: process.env.SUPERTOKENS_CONNECTION_URI || 'http://localhost:3567',
    apiKey: process.env.SUPERTOKENS_API_KEY || 'dev-api-key-change-in-production',
  },
};
```

### 4. Update Server.ts

Modify `src/Server.ts` to initialize SuperTokens:

```typescript
import supertokens from "supertokens-node";
import { middleware, errorHandler } from "supertokens-node/framework/express";
import { SuperTokensConfig } from "./backend/config/supertokens";

// Initialize SuperTokens
supertokens.init(SuperTokensConfig);

// Add middleware AFTER bodyParser
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));

// Add SuperTokens middleware
app.use(middleware());

// ... rest of your routes ...

// Error handler (should be last)
app.use(errorHandler());
```

### 5. Replace Auth Routes

Update `src/backend/routes/auth.routes.ts`:

```typescript
import express from 'express';
import { verifySession } from 'supertokens-node/recipe/session/framework/express';
import { emailPasswordSignUpPOST, emailPasswordSignInPOST } from 'supertokens-node/recipe/emailpassword';
import { signOutPOST } from 'supertokens-node/recipe/session/framework/express';

const router = express.Router();

// Sign up
router.post('/register', emailPasswordSignUpPOST());

// Sign in
router.post('/login', emailPasswordSignInPOST());

// Sign out
router.post('/logout', signOutPOST());

// Protected route example
router.get('/profile', verifySession(), async (req, res) => {
  const userId = req.session?.getUserId();
  res.json({ userId });
});

export default router;
```

### 6. Update Auth Middleware

Update `src/backend/middleware/auth.middleware.ts`:

```typescript
import { verifySession } from 'supertokens-node/recipe/session/framework/express';

// Use SuperTokens session verification
export const authenticateToken = verifySession();
```

---

## Frontend Integration

### 1. Install Dependencies

```bash
cd src/frontend
npm install supertokens-auth-react supertokens-website
```

### 2. Create SuperTokens Configuration

Create `src/frontend/src/config/supertokens.ts`:

```typescript
import { SuperTokensConfig } from "supertokens-auth-react";
import EmailPassword from "supertokens-auth-react/recipe/emailpassword";

export const supertokensConfig: SuperTokensConfig = {
  appInfo: {
    appName: "Skaftin",
    apiDomain: "http://localhost:4005",
    websiteDomain: "http://localhost:3005",
  },
  recipeList: [
    EmailPassword.init({
      emailVerificationFeature: {
        mode: "OPTIONAL",
      },
    }),
  ],
};
```

### 3. Update main.tsx

Modify `src/frontend/src/main.tsx`:

```typescript
import React from 'react';
import ReactDOM from 'react-dom/client';
import { SuperTokensProvider } from "supertokens-auth-react";
import { supertokensConfig } from './config/supertokens';
import App from './App';

SuperTokensProvider.init(supertokensConfig);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
```

### 4. Create Auth Pages with SuperTokens UI

Update `src/frontend/src/pages/LoginPage.tsx`:

```typescript
import { EmailPasswordAuth } from "supertokens-auth-react/recipe/emailpassword";
import { SessionAuth } from "supertokens-auth-react/recipe/session";
import { useNavigate } from "react-router-dom";

export default function LoginPage() {
  const navigate = useNavigate();

  return (
    <SessionAuth>
      <EmailPasswordAuth
        onSessionCallback={() => {
          navigate('/dashboard');
        }}
      />
    </SessionAuth>
  );
}
```

### 5. Update AuthService

Simplify `src/frontend/src/services/AuthService.ts`:

```typescript
import { signIn, signOut } from "supertokens-auth-react/recipe/emailpassword";
import { doesSessionExist } from "supertokens-auth-react/recipe/session";

class AuthService {
  static async login(email: string, password: string) {
    try {
      const response = await signIn({
        formFields: [{ id: "email", value: email }, { id: "password", value: password }],
      });
      
      return {
        success: true,
        user: response.user,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Login failed',
      };
    }
  }

  static async register(email: string, password: string) {
    try {
      const response = await signIn({
        formFields: [{ id: "email", value: email }, { id: "password", value: password }],
      });
      
      return {
        success: true,
        user: response.user,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Registration failed',
      };
    }
  }

  static async logout() {
    await signOut();
  }

  static async isAuthenticated(): Promise<boolean> {
    return await doesSessionExist();
  }
}

export default AuthService;
```

---

## Configuration

### Environment Variables

Add to your `.env`:

```bash
# SuperTokens
SUPERTOKENS_CONNECTION_URI=http://localhost:3567
SUPERTOKENS_API_KEY=dev-api-key-change-in-production
```

### CORS Configuration

Ensure your `src/backend/config/environment.ts` has proper CORS settings:

```typescript
cors: {
  origin: [
    `http://localhost:${process.env.FRONTEND_PORT || 3005}`,
    `http://127.0.0.1:${process.env.FRONTEND_PORT || 3005}`,
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: true, // Important for SuperTokens
},
```

---

## Testing

### 1. Start Services

```bash
# Terminal 1: Start SuperTokens
docker compose up -d

# Terminal 2: Start backend
npm run dev:backend

# Terminal 3: Start frontend
npm run dev:frontend
```

### 2. Test Registration

Navigate to `http://localhost:3005` and:
1. Enter email and password
2. Click "Sign Up"
3. Should redirect to dashboard on success

### 3. Test Login

1. Log out
2. Enter credentials
3. Click "Sign In"
4. Should redirect to dashboard

### 4. Test Protected Routes

Access a protected route - should require authentication.

---

## Troubleshooting

### SuperTokens won't connect to PostgreSQL

**Error**: `The server requested SCRAM-based authentication, but no password was provided`

**Solution**: Ensure password is URL-encoded in the connection string:
- `#` becomes `%23`
- Example: `password#123` → `password%23123`

### CORS Issues

**Error**: `Access-Control-Allow-Origin`

**Solution**: 
1. Check CORS configuration in backend
2. Ensure `credentials: true` is set
3. Verify frontend domain matches exactly

### Session Not Persisting

**Error**: User logged out on refresh

**Solution**:
1. Verify cookies are being set (check browser DevTools)
2. Ensure frontend domain matches backend configuration
3. Check if browser is blocking third-party cookies

### Docker Connection Issues

**Error**: Container can't reach PostgreSQL

**Solution**:
1. Use `network_mode: "host"` on Linux
2. Use `host.docker.internal` on Mac/Windows
3. Verify PostgreSQL is running: `sudo systemctl status postgresql`

### Port Already in Use

**Error**: `Port 3567 is already in use`

**Solution**:
```bash
# Find and kill process
lsof -ti:3567 | xargs kill -9

# Or change the port in docker-compose.yml
ports:
  - "3568:3567"
```

---

## Migration from Custom Auth

### Existing Users

SuperTokens creates its own user tables. To migrate existing users:

1. Export users from `auth.users` table
2. Use SuperTokens Admin API to create users
3. Update passwords or use password reset flow

### Database Schema

SuperTokens creates these tables:
- `supertokens_session_*`
- `supertokens_emailpassword_*`
- `supertokens_emailverification_*`

These coexist with your existing schema.

---

## Production Considerations

### Security

1. **Change API Key**: Use a strong, random API key in production
2. **Use HTTPS**: Enable SSL for SuperTokens connection
3. **Environment Variables**: Never commit secrets to git
4. **Rate Limiting**: Configure rate limits on auth endpoints

### Docker Production Setup

```yaml
services:
  supertokens:
    image: registry.supertokens.io/supertokens/supertokens-postgresql:latest
    container_name: skaftin-supertokens-prod
    restart: unless-stopped
    environment:
      POSTGRESQL_CONNECTION_URI: ${POSTGRESQL_CONNECTION_URI}
      API_KEYS: ${SUPERTOKENS_API_KEY}
    ports:
      - "3567:3567"
    volumes:
      - ./logs:/logs
    networks:
      - skaftin-network
```

### Monitoring

- Check SuperTokens logs: `docker compose logs supertokens`
- Monitor PostgreSQL connections
- Set up health checks for SuperTokens endpoint

---

## Additional Resources

- [SuperTokens Documentation](https://supertokens.com/docs)
- [SuperTokens GitHub](https://github.com/supertokens/supertokens-core)
- [Email Password Recipe Docs](https://supertokens.com/docs/emailpassword)
- [Session Management](https://supertokens.com/docs/session/common-customizations)

---

## Support

If you encounter issues:
1. Check SuperTokens logs: `docker compose logs -f supertokens`
2. Review browser console for frontend errors
3. Check backend logs for authentication errors
4. Visit [SuperTokens Community](https://github.com/supertokens/supertokens-core/discussions)
