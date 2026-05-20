# Adding Google Sign-In to Skaftin

This guide is for **Skaftin platform developers** who need to expose a Google OAuth exchange endpoint that mobile apps (starting with Rydnex) can call after the user signs in with Google on the device.

Rydnex already obtains a Google **ID token** via `@react-native-google-signin/google-signin`. The missing piece is a Skaftin auth route that verifies that JWT and returns the same session shape as password login.

---

## Current state

| Layer | Status |
|-------|--------|
| Rydnex native Google Sign-In | Configured (`EXPO_PUBLIC_WEB_CLIENT_ID`, `google-services.json`, `_layout.tsx`) |
| Rydnex → Skaftin API call | **Disabled** — `GOOGLE_SIGN_IN_ENABLED = false` in `src/constants/AppConfig.ts` |
| Skaftin documented auth API | No Google route in `client-sdk-mobile/requests/01-AUTH-REQUESTS.md` |
| Previously attempted path | `POST /app-api/auth/auth/google-sign-in` — **does not exist** on the platform |

Password login and the rest of auth (`/app-api/auth/auth/login`, register, OTP, etc.) already work and should be the reference for responses and session issuance.

---

## End-to-end flow

```
Mobile app                          Google                    Skaftin
──────────                          ──────                    ───────
User taps "Continue with Google"
        │
        ▼
GoogleSignin.signIn()  ──────────►  Native chooser
        │                           Returns idToken (JWT)
        ▼
POST /app-api/auth/auth/google-sign-in
  { "idToken": "..." }  ─────────────────────────────────►  1. Verify JWT (signature, aud, iss, exp)
                                                              2. Read email, name, sub from claims
                                                              3. Find or create app_user
                                                              4. Issue session (same as login)
        ◄──────────────────────────────────────────────────  { user, session: { accessToken } }
Store JWT in AuthStore / use for Bearer on /app-api/*
```

The app **never** sends Google `client_secret` to Skaftin. Only the **ID token** (public JWT) is posted, with the project **API key** (same as login/register).

---

## Proposed API contract

Follow the same patterns as other auth endpoints in `01-AUTH-REQUESTS.md`: standard JSON envelope, `x-api-key` on app-api routes, and a project-scoped alternative if you use `/api/auth/{projectId}/auth/*` elsewhere.

### App-api compatibility route (recommended for mobile)

**Endpoint:** `POST /app-api/auth/auth/google-sign-in`

**Headers:**

```
Content-Type: application/json
x-api-key: <project-api-key>
```

**Request body:**

```json
{
  "idToken": "eyJhbGciOiJSUzI1NiIsImtpZCI6Ij..."
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `idToken` | string | Yes | Google ID token from the mobile SDK (`user.data.idToken`) |

**Success response** — mirror **login** (`POST /app-api/auth/auth/login`) so clients can reuse the same mapping:

```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "id": 1,
      "name": "Jane",
      "last_name": "Doe",
      "email": "jane@example.com",
      "phone": null,
      "is_active": true,
      "roles": [
        { "id": 2, "role_name": "User", "role_key": "user" }
      ]
    },
    "session": {
      "accessToken": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9..."
    },
    "organisation_id": null,
    "organisation_name": null,
    "is_admin": false
  }
}
```

**Error responses** (examples):

```json
{
  "success": false,
  "message": "Invalid or expired Google token"
}
```

```json
{
  "success": false,
  "message": "Google sign-in is disabled for this project"
}
```

```json
{
  "success": false,
  "message": "Registration is disabled for this project",
  "data": {
    "requires_registration": true,
    "email": "jane@example.com"
  }
}
```

Use HTTP **401** for invalid tokens, **403** for disabled feature / policy blocks, **400** for malformed body.

### Project-scoped route (optional)

**Endpoint:** `POST /api/auth/{projectId}/auth/google-sign-in`

Same body and response as above. Headers: `x-api-key` (or your existing auth-management rules). Mobile apps in this repo call **app-api** paths via `SkaftinClient`, not `{projectId}` in the URL.

---

## Server implementation checklist

### 1. Per-project configuration

Store settings on the Skaftin **project** (admin UI or env):

| Setting | Purpose |
|---------|---------|
| `google_sign_in_enabled` | Feature flag; return 403 when false |
| `google_web_client_ids` | List of allowed `aud` values (see below) |
| `google_auto_register` | If true, create `app_user` on first Google login; if false, only allow existing users |
| `default_role_key` | Role for auto-created users (e.g. `user`) |

**Trusted audience (`aud`):** The mobile app passes `webClientId` to `GoogleSignin.configure()`. The ID token’s `aud` claim must match one of the project’s configured **Web application** OAuth client IDs (not the Android-only client ID).

For Rydnex, that value is `EXPO_PUBLIC_WEB_CLIENT_ID` in the app `.env`.

### 2. Verify the Google ID token

Do **not** trust the client beyond cryptographic verification.

1. Fetch Google’s signing keys (JWKS), e.g. `https://www.googleapis.com/oauth2/v3/certs` (cache with TTL).
2. Verify JWT **signature**, **exp** / **iat**, and **iss** (`accounts.google.com` or `https://accounts.google.com`).
3. Verify **aud** is in the project’s `google_web_client_ids` list.
4. Require **email** claim; optionally require `email_verified === true`.
5. Use **sub** as stable Google user id (store on `app_user` or a `auth_identities` table) to link accounts.

**Node.js example (library):**

```js
const { OAuth2Client } = require('google-auth-library');

const client = new OAuth2Client();
const ticket = await client.verifyIdToken({
  idToken,
  audience: allowedWebClientIds, // array from project settings
});
const payload = ticket.getPayload();
// payload.email, payload.name, payload.sub, payload.picture
```

**Other stacks:** Use the equivalent (e.g. `google.golang.org/api/idtoken`, Java `GoogleIdTokenVerifier`, Python `google.oauth2.id_token`).

### 3. Resolve the app user

Suggested logic:

1. Look up by `(provider = 'google', provider_subject = sub)` if you store external identities.
2. Else look up by **email** (case-insensitive).
3. If found and inactive / pending OTP, apply the same rules as password login (return `requires_otp` in `data` if that’s your pattern).
4. If not found:
   - `google_auto_register === true` → create user (name from `given_name` / `name`, email from token), assign `default_role_key`.
   - else → `success: false` with a clear message.

Avoid creating duplicate users when the same person already registered with email/password; prefer linking Google `sub` to the existing row after email match.

### 4. Issue session

Reuse the **exact** code path as `POST /auth/login` after credentials are validated:

- Same JWT/session table
- Same `accessToken` format and TTL
- Same role and organisation attachment

Clients map `data.user` + `data.session.accessToken` in `AuthService.loginDataFromApi()`.

### 5. Register the route

- Mount under the existing app-api auth router (alongside `login`, `register`, `verify-otp`).
- Apply the same middleware: API key validation, project context, rate limiting (recommended on this route).
- Do **not** require `Authorization: Bearer` on this endpoint (user is not logged in yet); use `skipUserAuthorization` on the client, same as login.

### 6. Document in the client SDK

Add a new section to `client-sdk-mobile/requests/01-AUTH-REQUESTS.md` (e.g. **§16. Google Sign-In**) with the contract above. Mobile teams rely on that file; do not invent field names only in app code.

### 7. Security and operations

- **Rate limit** per IP and per `idToken` hash to reduce abuse.
- **Log** failures without storing full tokens.
- **Rotate** allowed client IDs when the app ships new OAuth clients (iOS/Android/Web).
- For production Android, register **Play App Signing** SHA-1 in Google Cloud (separate from debug); that affects Google’s mobile SDK, not Skaftin’s JWT verification.
- Optional: restrict sign-in to email domains allow-list per project.

---

## Google Cloud / Firebase (app team — for reference)

Skaftin only sees the **ID token**. The app team must keep Google Console aligned:

| Item | Rydnex value |
|------|----------------|
| Android package | `com.bobosoftware.rydnex` |
| Debug SHA-1 | `5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25` |
| Web client ID (`aud`) | `EXPO_PUBLIC_WEB_CLIENT_ID` in `.env` |
| Android config file | `android/app/google-services.json` (must include `oauth_client` entries) |

All OAuth clients used by the app should live in the **same** Google Cloud project, and `aud` on the token must match a configured Web client ID on the Skaftin project.

---

## Enabling the feature in Rydnex (after Skaftin ships)

1. Confirm the route works (e.g. curl below).
2. Update `client-sdk-mobile/requests/01-AUTH-REQUESTS.md` in this repo.
3. In Rydnex:
   - Add to `src/constants/ApiRoutes.ts`:
     ```ts
     googleSignIn: '/app-api/auth/auth/google-sign-in',
     ```
   - Restore `skaftinClient.post(routes.auth.googleSignIn, { idToken }, { skipUserAuthorization: true })` in `AuthService.loginWithGoogle`.
   - Set `GOOGLE_SIGN_IN_ENABLED = true` in `src/constants/AppConfig.ts`.
4. Rebuild the app; test login and register screens.

See also `docs/03-features/feature-guide.md` (Authentication).

---

## Testing

### curl (app-api)

```bash
curl -s -X POST "$EXPO_PUBLIC_SKAFTIN_API_URL/app-api/auth/auth/google-sign-in" \
  -H "Content-Type: application/json" \
  -H "x-api-key: $EXPO_PUBLIC_SKAFTIN_API_KEY" \
  -d '{"idToken":"PASTE_REAL_ID_TOKEN_FROM_DEVICE_LOG"}' | jq
```

Obtain a real `idToken` by temporarily logging it in the app after `GoogleSignin.signIn()` (remove before release).

### Manual checks

| Case | Expected |
|------|----------|
| Valid token, existing user | `success: true`, `session.accessToken` present |
| Valid token, new user, auto-register on | User created, session returned |
| Valid token, new user, auto-register off | `success: false`, clear message |
| Expired / tampered token | 401, `success: false` |
| Wrong `aud` (wrong Web client ID) | 401 |
| Feature disabled for project | 403 |
| Missing `idToken` | 400 |

### Regression

- Password login, register, and OTP flows unchanged.
- Bearer token from Google login works on `/app-api/database/*` and other authenticated routes.

---

## Suggested database additions (optional)

If the platform does not already store social logins:

```sql
-- Example only — adapt to Skaftin schema naming
CREATE TABLE app_user_auth_providers (
  id SERIAL PRIMARY KEY,
  app_user_id INTEGER NOT NULL REFERENCES app_users(id),
  provider VARCHAR(32) NOT NULL,  -- 'google'
  provider_subject VARCHAR(255) NOT NULL,  -- Google 'sub'
  email VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (provider, provider_subject)
);
```

---

## Summary

| Who | Action |
|-----|--------|
| **Skaftin** | Implement `POST /app-api/auth/auth/google-sign-in`, verify Google JWT `aud` against per-project Web client IDs, issue same session as login, document in `01-AUTH-REQUESTS.md` |
| **Rydnex app** | Enable flag + route after API exists |
| **Google Cloud** | Web + Android OAuth clients, SHA-1, `google-services.json` with non-empty `oauth_client` |

Until Skaftin exposes this endpoint, users should sign in with **email and password** (or OTP flows already documented in the auth API).
