# SuperTokens Integration Guide

## ✅ What's Been Completed

### 1. **Docker Setup**
- ✅ SuperTokens Core running on port **3567**
- ✅ Connected to existing PostgreSQL database (skaftin_db)
- ✅ Using dedicated schema: `supertokens`
- ✅ Container name: `skaftin-supertokens`

**Verify SuperTokens is running:**
```bash
curl http://localhost:3567/hello
# Should return: Hello
```

**View SuperTokens logs:**
```bash
docker logs skaftin-supertokens
```

### 2. **Backend Packages Installed**
```bash
npm install supertokens-node
```

### 3. **Backend Configuration**

#### File Structure Created:
```
src/
├── config/
│   └── supertokens.ts          # SuperTokens initialization
├── middleware/
│   └── supertokensAuthMiddleware.ts  # New auth middleware
```

#### Server.ts Updates:
- ✅ SuperTokens initialized on startup
- ✅ SuperTokens middleware added (MUST come before routes)
- ✅ SuperTokens error handler added (MUST come after routes)
- ✅ CORS configured for SuperTokens compatibility
- ✅ Auth routes automatically registered at `/auth`

### 4. **Authentication Flow**

#### SuperTokens Routes (Auto-registered):
```
POST /auth/signup          # Register new user
POST /auth/signin          # Login
POST /auth/signout         # Logout
GET  /auth/sessioninfo     # Get session info
POST /auth/session/refresh # Refresh session
```

#### SuperTokens Dashboard:
```
http://localhost:4005/auth/dashboard
```

### 5. **Middleware Architecture**

#### New Middleware Functions:
```typescript
authenticateSession          // Verifies SuperTokens session
attachUserInfo              // Fetches user data and projectIds
verifyProjectAccess         // Checks project ownership
requireAdmin                // Admin-only routes

// Combined helpers:
authenticateAndAttachUser   // Auth + User Info
authenticateAndVerifyProject // Auth + User Info + Project Access
```

#### Router Updates:
- ✅ ProjectsRouter: Uses `authenticateAndAttachUser`
- ✅ DatabaseRouter: Uses `authenticateAndVerifyProject`
- ✅ FilesRouter: Uses `authenticateAndAttachUser`
- ✅ UsersRouter: Uses `authenticateAndAttachUser` + `requireAdmin`

### 6. **Session Management**

SuperTokens provides:
- **Session Tokens** stored as HTTP-only cookies
- **Anti-CSRF protection** built-in
- **Access Token** (short-lived: 1 hour)
- **Refresh Token** (long-lived: 100 days)
- **Automatic token refresh**

Session payload includes:
```typescript
{
  userId: string,      // SuperTokens user ID
  email: string,
  projectIds: number[], // User's project IDs (from database)
  role: string,        // 'user' or 'admin'
}
```

### 7. **Environment Variables**

Added to `.env`:
```env
# SuperTokens Configuration
SUPERTOKENS_CONNECTION_URI=http://localhost:3567
SUPERTOKENS_API_KEY=your-api-key-change-in-production
SUPERTOKENS_APP_NAME=Skaftin
SUPERTOKENS_API_DOMAIN=http://localhost:4005
SUPERTOKENS_WEBSITE_DOMAIN=http://localhost:3005
```

## 🔄 Database Migration Required

### Update Projects Table:

The `projects` table references `user_id` which needs to be updated to use SuperTokens user IDs (UUIDs instead of integers).

**Migration Steps:**

1. **Drop existing projects** (if any test data):
```sql
TRUNCATE TABLE projects CASCADE;
```

2. **Update projects table schema**:
```sql
ALTER TABLE projects 
  DROP CONSTRAINT IF EXISTS projects_user_id_fkey;

ALTER TABLE projects 
  ALTER COLUMN user_id TYPE VARCHAR(255);

-- No foreign key to users table anymore (SuperTokens manages users)
```

3. **Drop old users table** (SuperTokens manages users now):
```sql
DROP TABLE IF EXISTS users CASCADE;
```

## 📝 Frontend Integration Required

### 1. **Install Frontend Packages**
Already installed:
```bash
npm install supertokens-auth-react supertokens-web-js
```

### 2. **Initialize SuperTokens in Frontend**

Create `frontend/src/config/supertokens.ts`:
```typescript
import SuperTokens from "supertokens-auth-react";
import EmailPassword from "supertokens-auth-react/recipe/emailpassword";
import Session from "supertokens-auth-react/recipe/session";

SuperTokens.init({
  appInfo: {
    appName: "Skaftin",
    apiDomain: "http://localhost:4005",
    websiteDomain: "http://localhost:3005",
    apiBasePath: "/auth",
    websiteBasePath: "/auth",
  },
  recipeList: [
    EmailPassword.init({
      signInAndUpFeature: {
        signUpForm: {
          formFields: [
            {
              id: "name",
              label: "Full Name",
              placeholder: "Enter your name",
            },
          ],
        },
      },
    }),
    Session.init(),
  ],
});
```

### 3. **Update App.tsx**

```typescript
import SuperTokens, { SuperTokensWrapper } from "supertokens-auth-react";
import { SessionAuth } from "supertokens-auth-react/recipe/session";
import "./config/supertokens"; // Initialize SuperTokens

function App() {
  return (
    <SuperTokensWrapper>
      {/* Your existing app routes */}
    </SuperTokensWrapper>
  );
}
```

### 4. **Update Login/Register Pages**

Replace custom auth with SuperTokens components:
```typescript
import { EmailPasswordComponentsOverrideProvider } from "supertokens-auth-react/recipe/emailpassword";
import { signIn, signUp } from "supertokens-auth-react/recipe/emailpassword";

// Or use pre-built UI:
import { EmailPasswordPreBuiltUI } from "supertokens-auth-react/recipe/emailpassword/prebuiltui";
```

### 5. **Update Protected Routes**

```typescript
import { SessionAuth } from "supertokens-auth-react/recipe/session";

<SessionAuth>
  <YourProtectedComponent />
</SessionAuth>
```

### 6. **Remove Old Auth Service**

Delete or update:
- `frontend/src/services/AuthService.ts`
- Remove JWT token management from `localStorage`
- SuperTokens handles session management automatically

### 7. **Update API Calls**

SuperTokens automatically:
- ✅ Sends session cookies with requests
- ✅ Refreshes tokens when needed
- ✅ Handles CSRF protection

**No manual token management needed!**

Just ensure `credentials: 'include'` in fetch/axios:
```typescript
fetch('http://localhost:4005/api/projects/list', {
  credentials: 'include', // Important!
})
```

## 🔐 Security Improvements

### SuperTokens vs Manual JWT:

| Feature | Manual JWT | SuperTokens |
|---------|-----------|-------------|
| Session Storage | localStorage (XSS vulnerable) | HTTP-only cookies (XSS safe) |
| CSRF Protection | Manual | Built-in |
| Token Refresh | Manual logic needed | Automatic |
| Session Revocation | Complex | Built-in |
| Multi-device Sessions | Manual tracking | Built-in |
| User Management | Custom tables | Managed by SuperTokens |
| Password Reset | Custom implementation | Built-in |
| Email Verification | Custom implementation | Built-in |

## 🧪 Testing the Integration

### 1. **Start the Backend**
```bash
npm run dev
```

### 2. **Register a New User**
```bash
curl -X POST http://localhost:4005/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "formFields": [
      {"id": "email", "value": "test@example.com"},
      {"id": "password", "value": "password123"},
      {"id": "name", "value": "Test User"}
    ]
  }'
```

### 3. **Sign In**
```bash
curl -X POST http://localhost:4005/auth/signin \
  -H "Content-Type: application/json" \
  -c cookies.txt \
  -d '{
    "formFields": [
      {"id": "email", "value": "test@example.com"},
      {"id": "password", "value": "password123"}
    ]
  }'
```

### 4. **Access Protected Route**
```bash
curl -X GET http://localhost:4005/api/projects/list \
  -b cookies.txt
```

## 📊 SuperTokens Dashboard

Access the admin dashboard:
```
http://localhost:4005/auth/dashboard
```

View and manage:
- Users
- Sessions
- Email templates
- Configuration

## 🔄 Next Steps

1. ✅ Backend configured and running
2. ⏳ Run database migrations (drop users table, update projects)
3. ⏳ Configure frontend with SuperTokens
4. ⏳ Update ProjectsController to use SuperTokens user IDs
5. ⏳ Test authentication flow
6. ⏳ Update user stores in frontend
7. ⏳ Remove old JWT-based auth code

## 🆘 Troubleshooting

### SuperTokens not connecting?
```bash
docker logs skaftin-supertokens
```

### CORS issues?
Ensure `credentials: 'include'` in frontend requests and CORS is configured for SuperTokens.

### Session not found?
Check cookies are being sent. May need to update `sameSite` cookie settings for local development.

## 📚 Resources

- [SuperTokens Docs](https://supertokens.com/docs/guides)
- [SuperTokens React SDK](https://supertokens.com/docs/emailpassword/introduction)
- [Session Management](https://supertokens.com/docs/session/introduction)

