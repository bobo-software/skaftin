# Apple Sign-In — Backend Implementation

This guide describes how to implement **Sign in with Apple** on the Skaftin backend so it works alongside the existing **Google Sign-In** flow in Rydnex. For iOS client setup (capability, EAS rebuild, App Review), see **`ios-apple-sign-in-setup.md`**.

For Google OAuth setup, see **`firebase-google-cloud-setup.md`**.

---

## Overview

Rydnex uses the same session pipeline for email login, Google, and Apple. After a successful social sign-in, the mobile app maps the response with `loginDataFromApi` in `src/backend/services/AuthService.ts` and stores the session in `AuthStore`.

```
User taps "Continue with Apple" (iOS)
        │
        ▼
AppleAuthentication.signInAsync()   ← expo-apple-authentication
        │
        ▼
identityToken (+ authorizationCode, fullName on first sign-in)
        │
        ▼
POST /app-api/auth/auth/apple-sign-in   ← Skaftin verifies Apple JWT
        │
        ▼
{ user, accessToken }  (same shape as google-sign-in)
        │
        ▼
Session stored in AuthStore
```

---

## Google vs Apple — parity table

| | Google | Apple |
|---|--------|-------|
| **Mobile endpoint** | `POST /app-api/auth/auth/google-sign-in` | `POST /app-api/auth/auth/apple-sign-in` |
| **Primary credential** | `idToken` (Google JWT) | `identityToken` (Apple JWT) |
| **Stable user key** | Google `sub` claim | Apple `sub` claim |
| **Email source** | JWT `email` claim | JWT `email` claim (may be Hide My Email relay) |
| **Name source** | JWT / Google profile | Request body `fullName` on **first sign-in only** (Apple never puts name in JWT) |
| **Success response** | `{ success: true, data: { user, accessToken, ... } }` | Same |
| **New-user hint** | `is_new_user` or recent `user.created_at` | Same |
| **Platform auth header** | `X-API-Key` (no user Bearer) | Same |

The mobile client expects the **same `data` object shape** as `google-sign-in`. Do not invent a different session structure for Apple.

---

## Apple Developer Portal setup

Do this before configuring Skaftin or testing end-to-end.

### 1. Enable Sign In with Apple on the App ID

1. [Apple Developer](https://developer.apple.com) → **Certificates, Identifiers & Profiles** → **Identifiers**.
2. Select App ID **`com.bobosoftware.rydnex`** (must match `app.json` → `ios.bundleIdentifier`).
3. Enable **Sign In with Apple**.
4. Save.

### 2. Create a Sign In with Apple key (.p8)

1. **Keys** → **+** → name e.g. `Rydnex Apple Sign In`.
2. Enable **Sign In with Apple** → configure with primary App ID `com.bobosoftware.rydnex`.
3. Register and **download the `.p8` file once** (cannot re-download).
4. Note **Key ID** and your **Team ID** (Membership details).

You need these three values in Skaftin (or custom backend):

| Value | Example / location |
|-------|-------------------|
| Team ID | Apple Developer → Membership |
| Key ID | Keys list |
| Private key | Contents of `AuthKey_XXXXX.p8` |
| Client ID (audience) | `com.bobosoftware.rydnex` (native iOS — bundle ID) |

### 3. Services ID (not required for native iOS-only)

Rydnex currently uses **native iOS Sign in with Apple** only. The JWT `aud` claim equals the **bundle ID**.

If you later add Sign in with Apple on **web** or **Android**, you must create a **Services ID**, configure return URLs, and use that Services ID as `aud` for those platforms.

---

## API contract

### Request

```
POST /app-api/auth/auth/apple-sign-in
Content-Type: application/json
X-API-Key: <platform API key>
```

No `Authorization: Bearer` header — the user is not logged in yet.

**Body:**

```json
{
  "identityToken": "<JWT from Apple>",
  "authorizationCode": "<optional string>",
  "fullName": {
    "givenName": "Jane",
    "familyName": "Doe"
  }
}
```

| Field | Required | Notes |
|-------|----------|-------|
| `identityToken` | **Yes** | Apple identity token (JWT). Backend must verify cryptographically. |
| `authorizationCode` | No | One-time code from Apple. Store if you need server-side token refresh or account deletion callbacks. |
| `fullName` | No | Only present on the **first** authorization for this app + Apple ID. Apple will **not** send it again. Persist name immediately when creating a user. |

The mobile app sends this payload from `useAppleSignIn` → `authService.loginWithApple` in `src/backend/services/AuthService.ts`.

### Success response

Same as `google-sign-in`:

```json
{
  "success": true,
  "message": "Signed in",
  "data": {
    "user": {
      "id": 42,
      "name": "Jane Doe",
      "email": "abc123@privaterelay.appleid.com",
      "roles": [{ "id": 1, "role_key": "user", "role_name": "User" }],
      "created_at": "2026-06-29T12:00:00.000Z"
    },
    "accessToken": "<jwt>",
    "is_new_user": true
  }
}
```

Alternative token nesting (also supported by the app):

```json
{
  "success": true,
  "data": {
    "user": { "id": 42, "name": "Jane", "email": "..." },
    "session": { "accessToken": "<jwt>" }
  }
}
```

Optional flags the app understands for “account created” toasts:

- `data.is_new_user` / `data.isNewUser` / `data.new_user` / `data.user_created` → `true`
- Or `data.user.created_at` within ~90 seconds of sign-in

### Error response

Mirror `google-sign-in`:

```json
{
  "success": false,
  "message": "Invalid Apple identity token",
  "error": "token_expired"
}
```

The app surfaces `message` in a toast and inline error on the auth screen.

---

## JWT verification

Verify every `identityToken` on the server. **Never trust** client-supplied `email` or `fullName` without a valid JWT.

### Steps

1. Decode JWT header → read `kid` (key id).
2. Fetch Apple public keys: `GET https://appleid.apple.com/auth/keys` (cache ~24 hours).
3. Find the JWK matching `kid`, verify RS256 signature.
4. Validate claims:
   - `iss` === `"https://appleid.apple.com"`
   - `aud` === `"com.bobosoftware.rydnex"`
   - `exp` > current time
5. Extract claims for provisioning:
   - `sub` — stable Apple user identifier (**primary account link key**)
   - `email` — may be absent on repeat sign-ins if not stored server-side
   - `email_verified` — `"true"` / `true`
   - `is_private_email` — `"true"` when user chose Hide My Email

### Reference implementation (Node.js)

Using [`apple-signin-auth`](https://www.npmjs.com/package/apple-signin-auth):

```javascript
const appleSignin = require('apple-signin-auth');

async function verifyAppleIdentityToken(identityToken) {
  const payload = await appleSignin.verifyIdToken(identityToken, {
    audience: 'com.bobosoftware.rydnex',
    ignoreExpiration: false,
  });
  return payload; // { sub, email, email_verified, is_private_email, ... }
}
```

Manual JWKS verification is also fine if you prefer no extra dependency.

---

## User provisioning logic

Implement the same high-level flow as `google-sign-in`:

```
1. Verify identityToken → extract sub, email, is_private_email
2. Look up existing user by apple_sub (= sub)
   - Optional: link by verified email if no apple_sub yet (policy decision)
3. If not found:
   a. Build display name from request.fullName, else email local-part, else "Apple User"
   b. Create user with email from JWT (if present)
   c. Persist apple_sub, is_private_email (recommended columns)
   d. Set is_new_user: true in response
4. If found:
   a. Issue session (accessToken + refresh if applicable)
5. Return { success: true, data: { user, accessToken } }
```

### Recommended database fields

| Column | Purpose |
|--------|---------|
| `apple_sub` | Unique Apple user id (`sub` claim) — lookup key |
| `google_sub` | Existing Google link (if separate) |
| `is_private_email` | User enabled Hide My Email |
| `auth_provider` | `email` / `google` / `apple` (optional) |

Store `apple_sub` uniquely. Do not rely on email alone for Apple users.

---

## Hide My Email

When the user selects **Hide My Email**, Apple returns a relay address:

```
<unique-token>@privaterelay.appleid.com
```

Rules:

- Email appears in the JWT on **first** sign-in for that app + Apple ID. **Persist it immediately.**
- On subsequent sign-ins, email may be omitted from the JWT — look up by `sub`.
- Do not force email verification OTP for `@privaterelay.appleid.com` addresses unless product policy requires it.
- Apple forwards mail to the user’s real inbox; your app only sees the relay.

---

## Skaftin configuration checklist

If Skaftin provides a built-in Apple provider, enable it in the project auth settings and point it at:

- **Bundle ID / Client ID:** `com.bobosoftware.rydnex`
- **Team ID:** your Apple Developer team
- **Key ID:** from the `.p8` key
- **Private key:** `.p8` file contents

If implementing a **custom auth hook** or serverless handler:

1. Register route `POST /app-api/auth/auth/apple-sign-in` (or configure Skaftin to proxy to your handler).
2. Verify JWT as above.
3. Return the same `data` shape as `google-sign-in`.
4. Rate-limit the endpoint (same as Google).
5. Log verification failures without logging full tokens.

### Verify Google still works

After Apple is live, regression-test:

- `POST /app-api/auth/auth/google-sign-in` with a real Google `idToken`
- `POST /app-api/auth/auth/apple-sign-in` with a real Apple `identityToken`

Both should return interchangeable session payloads.

---

## Security notes

- **Verify JWT on every request** — treat `identityToken` like Google’s `idToken`.
- **`fullName` is client-supplied** — use only when creating a new user and only after JWT verification; Apple does not include name in the JWT.
- **Do not log** `identityToken`, `authorizationCode`, or `.p8` key material.
- **Link accounts by `sub`**, not email, for Apple users.
- **Rotate Apple keys** in Developer Portal if `.p8` is compromised; update Skaftin config.

---

## Testing

| Test | How |
|------|-----|
| New Apple user | Sign in with Apple on a device that never authorized Rydnex → user created, session returned |
| Returning user | Sign in again → same `sub`, existing user, no duplicate account |
| Hide My Email | Choose hide email on first sign-in → relay stored, login works on repeat |
| Invalid token | POST expired/tampered JWT → `success: false` |
| App Review path | Login screen → Apple button **above** Google → both work |

Use a **physical iPhone** for final validation. Simulator works if signed into an Apple ID under Settings → Apple Account.

Backend can be tested with curl once you have a captured `identityToken` from a dev build (tokens are short-lived — use immediately):

```bash
curl -X POST "$SKAFTIN_URL/app-api/auth/auth/apple-sign-in" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $SKAFTIN_API_KEY" \
  -d '{"identityToken":"<paste-jwt-here>"}'
```

---

## App Store resubmission reply (template)

Reply in App Store Connect after uploading a build with Sign in with Apple:

> We added **Sign in with Apple** on the Login and Create Account screens as an equivalent sign-in option alongside Google Sign-In, in compliance with Guideline 4.8. Sign in with Apple limits data collection to the user’s name and email, supports **Hide My Email**, and does not use in-app interactions for advertising. On the Login screen, tap **Continue with Apple** (shown above Continue with Google) to test.

---

## Related files in this repo

| File | Role |
|------|------|
| `src/constants/ApiRoutes.ts` | `appleSignIn` route |
| `src/constants/AppConfig.ts` | `APPLE_SIGN_IN_ENABLED` |
| `src/backend/services/AuthService.ts` | `loginWithApple` |
| `src/contexts/AuthContext.tsx` | `loginWithApple` context method |
| `src/hooks/useAppleSignIn.ts` | Native Apple credential → API payload |
| `src/components/auth/SocialSignInButtons.tsx` | Apple + Google UI on auth screens |
| `app.json` | `usesAppleSignIn`, `expo-apple-authentication` plugin |
| `docs/01-getting-started/ios-apple-sign-in-setup.md` | iOS client checklist |
