# Push Notifications — Backend Implementation

This guide describes what the **Skaftin backend** must provide so the Rydnex **React Native (Expo)** app can deliver push notifications on **iOS and Android**.

For mobile client setup (`expo-notifications`, EAS credentials, permission prompts), see the companion section at the end and future client doc. This file focuses on **server-side** requirements: storage, APIs, sending, scheduling, and Rydnex-specific triggers.

---

## Overview

Rydnex uses **Expo Push Notifications**. The mobile app obtains an **Expo push token** (`ExponentPushToken[...]`) via `expo-notifications`. The backend stores that token per user/device and sends notifications through the **Expo Push API**, which routes to:

- **iOS** → Apple Push Notification service (APNs)
- **Android** → Firebase Cloud Messaging (FCM)

The backend does **not** talk to APNs or FCM directly in the recommended setup. Expo’s relay handles platform differences; your server only needs HTTPS calls to `https://exp.host/--/api/v2/push/send`.

```
React Native app (iOS / Android)
        │
        ▼
expo-notifications → Expo push token
        │
        ▼
POST /app-api/notifications/register-token   ← authenticated user
        │
        ▼
device_push_tokens table (Skaftin DB)
        │
        ▼
Cron job / event handler / server function
        │
        ▼
POST https://exp.host/--/api/v2/push/send
        │
        ├──► APNs (iOS)
        └──► FCM (Android)
```

### Why Expo Push for React Native?

| Approach | Pros | Cons |
|----------|------|------|
| **Expo Push API** (recommended) | One token format, one send API, works with existing EAS + Firebase project | Depends on Expo’s relay; not for non-Expo apps |
| **FCM + APNs directly** | Full control, no third-party relay | Two integrations, separate iOS/Android server code, credential management |

Rydnex already uses Expo 54, `expo-dev-client`, EAS (`projectId` in `app.json`), and Firebase project `rydnex-a4ddd`. Expo Push is the lowest-friction path for both platforms.

---

## Prerequisites (outside the backend)

These are configured in **Expo / EAS / Firebase**, not in Skaftin SQL — but the backend team should know they must exist before end-to-end testing works.

| Platform | Requirement | Where |
|----------|-------------|--------|
| **iOS** | APNs key (.p8) linked to bundle `com.bobosoftware.rydnex` | EAS Credentials (`eas credentials -p ios`) |
| **Android** | FCM V1 service account for Firebase `rydnex-a4ddd` | EAS Credentials + root `google-services.json` |
| **Both** | EAS project ID `48f25a0f-a630-40cb-bbde-595bfe06051f` | `app.json` → `extra.eas.projectId` |
| **Mobile** | Physical device + development/production build | Push does not work reliably in Expo Go |

Firebase setup for Google Sign-In is documented in **`firebase-google-cloud-setup.md`**. Push uses the **same** Firebase project for Android FCM credentials.

---

## Database schema

No push tables exist in the Rydnex schema today. Add the following.

### `device_push_tokens`

Stores Expo push tokens registered by the mobile app. One user may have multiple devices.

| Column | Type | Notes |
|--------|------|-------|
| `id` | serial PK | |
| `user_id` | integer NOT NULL | Skaftin app user id |
| `expo_push_token` | text NOT NULL | e.g. `ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]` |
| `platform` | varchar(16) NOT NULL | `ios` or `android` |
| `device_name` | text nullable | From `expo-device` (optional) |
| `app_version` | varchar(32) nullable | Optional; helps debug stale builds |
| `last_seen_at` | timestamptz NOT NULL | Updated on every register call |
| `created_at` | timestamptz NOT NULL DEFAULT now() | |
| `updated_at` | timestamptz NOT NULL DEFAULT now() | |

**Constraints and indexes:**

- `UNIQUE (expo_push_token)` — same token must not belong to two rows; on register, upsert and reassign `user_id` if the device was logged in as someone else.
- Index on `(user_id)` — fetch all tokens when sending to a user.
- Optional partial index on `(user_id, platform)` if you send platform-specific payloads.

**Lifecycle:**

- **Register** on login and on app foreground (token can rotate).
- **Unregister** on logout (delete row or soft-disable).
- **Prune** tokens that Expo returns as `DeviceNotRegistered` (see [Delivery errors](#delivery-errors-and-stale-tokens)).

### `notification_preferences` (recommended)

Per-user opt-in/out. The backend must check these before sending.

| Column | Type | Notes |
|--------|------|-------|
| `user_id` | integer PK | One row per user |
| `reminders_enabled` | boolean NOT NULL DEFAULT true | Part life, service due |
| `license_disk_enabled` | boolean NOT NULL DEFAULT true | Expiry warnings |
| `organisation_enabled` | boolean NOT NULL DEFAULT true | Join requests, fleet alerts |
| `marketing_enabled` | boolean NOT NULL DEFAULT false | Future use |
| `updated_at` | timestamptz NOT NULL DEFAULT now() | |

Create a default row when a user registers, or lazily on first preference read.

### `notification_log` (optional, recommended for production)

Audit and deduplication for scheduled jobs.

| Column | Type | Notes |
|--------|------|-------|
| `id` | serial PK | |
| `user_id` | integer NOT NULL | |
| `notification_type` | varchar(64) NOT NULL | e.g. `part_reminder`, `license_disk`, `org_join_request` |
| `reference_id` | varchar(128) nullable | e.g. `vehicle:42`, `request:7` — prevents duplicate sends |
| `title` | text NOT NULL | |
| `body` | text NOT NULL | |
| `data` | jsonb nullable | Payload echoed to the app |
| `expo_push_token` | text nullable | Token used |
| `expo_ticket_id` | varchar(128) nullable | From Expo send response |
| `status` | varchar(32) NOT NULL | `sent`, `failed`, `delivered`, `error` |
| `error_code` | varchar(64) nullable | e.g. `DeviceNotRegistered` |
| `created_at` | timestamptz NOT NULL DEFAULT now() | |

Unique constraint example: `UNIQUE (notification_type, reference_id, user_id)` where `reference_id` is set — so a daily cron does not spam the same reminder.

---

## HTTP API (Skaftin `/app-api`)

All endpoints require an authenticated session: `Authorization: Bearer <accessToken>` (same as other Rydnex app routes). Platform auth (`X-API-Key`) alone is not sufficient for token registration.

### `POST /app-api/notifications/register-token`

Called by the mobile app after login and when the push token changes.

**Request body:**

```json
{
  "expo_push_token": "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]",
  "platform": "ios",
  "device_name": "Bob's iPhone",
  "app_version": "1.0.0"
}
```

| Field | Required | Notes |
|-------|----------|-------|
| `expo_push_token` | Yes | Must match `ExponentPushToken[...]` format |
| `platform` | Yes | `ios` or `android` |
| `device_name` | No | Display/debug only |
| `app_version` | No | From `expo-constants` |

**Success response** (match existing Rydnex API style):

```json
{
  "success": true,
  "data": {
    "id": 1,
    "user_id": 42,
    "expo_push_token": "ExponentPushToken[...]",
    "platform": "ios",
    "last_seen_at": "2026-07-08T03:48:00.000Z"
  }
}
```

**Server behaviour:**

1. Resolve `user_id` from the Bearer token.
2. Upsert on `expo_push_token`: update `user_id`, `platform`, `last_seen_at`, `updated_at`.
3. If the same user registers a new token from the same device, keep one row per token (do not accumulate unbounded duplicates for one physical device unless you key by something else).

**Errors:**

| Status | `error` | When |
|--------|---------|------|
| 400 | `invalid_token` | Missing or malformed `expo_push_token` |
| 400 | `invalid_platform` | Not `ios` or `android` |
| 401 | `unauthorized` | Missing or invalid session |

### `DELETE /app-api/notifications/unregister-token`

Called on logout.

**Request body:**

```json
{
  "expo_push_token": "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]"
}
```

**Success:**

```json
{
  "success": true,
  "data": null
}
```

Delete the row matching `expo_push_token` (and optionally verify it belongs to the current user).

### `GET /app-api/notifications/preferences`

**Success:**

```json
{
  "success": true,
  "data": {
    "reminders_enabled": true,
    "license_disk_enabled": true,
    "organisation_enabled": true,
    "marketing_enabled": false
  }
}
```

### `PATCH /app-api/notifications/preferences`

**Request body** (partial update):

```json
{
  "reminders_enabled": false
}
```

**Success:** same shape as GET `data`.

---

## Sending notifications (Expo Push API)

### Endpoint

```
POST https://exp.host/--/api/v2/push/send
Content-Type: application/json
```

For high volume, Expo supports batching (array of messages) and receipt checking. Start with single messages; batch when sending cron-driven digests.

### Message shape

```json
{
  "to": "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]",
  "title": "Brake pads due soon",
  "body": "Your Toyota Corolla is within 500 km of replacement.",
  "data": {
    "screen": "reminders",
    "vehicleId": 42
  },
  "sound": "default",
  "priority": "high",
  "channelId": "reminders"
}
```

| Field | Required | Notes |
|-------|----------|-------|
| `to` | Yes | Expo push token from `device_push_tokens` |
| `title` | Yes* | Shown in notification tray |
| `body` | Yes* | Shown in notification tray |
| `data` | No | **Custom payload for deep linking** — keep JSON-serializable; the React Native app reads this on tap |
| `sound` | No | `"default"` or omit |
| `priority` | No | `"default"` or `"high"` (Android delivery) |
| `channelId` | No | Android notification channel; app should create matching channels |

\* Expo allows data-only pushes; for Rydnex user-facing alerts, always include `title` and `body`.

### Recommended `data` payload for React Native

The mobile app uses **expo-router**. Standardise `data.screen` so one listener can navigate:

| `data.screen` | Route | Trigger |
|---------------|-------|---------|
| `reminders` | `/reminders` | Part life warning/due |
| `license-disk` | `/log/license-disk` | License expiry |
| `organisation-requests` | `/organisation/organisation-requests` | New join request (admin) |
| `vehicle-details` | `/garage/vehicle-details-page` | Optional; include `vehicleId` |

Example:

```json
{
  "data": {
    "screen": "reminders",
    "vehicleId": 42,
    "notificationType": "part_reminder"
  }
}
```

### Server-side send helper (pseudocode)

```typescript
async function sendPushToUser(userId: number, message: {
  title: string;
  body: string;
  data?: Record<string, unknown>;
  notificationType: string;
  referenceId?: string;
}) {
  const prefs = await getNotificationPreferences(userId);
  if (!isAllowed(prefs, message.notificationType)) return;

  if (message.referenceId && await alreadySent(message.notificationType, message.referenceId, userId)) {
    return;
  }

  const tokens = await listActiveTokens(userId);
  for (const { expo_push_token } of tokens) {
    const res = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to: expo_push_token,
        title: message.title,
        body: message.body,
        data: message.data,
        sound: "default",
        priority: "high",
      }),
    });
    const ticket = await res.json();
    await logNotification({ userId, token: expo_push_token, ticket, ...message });
    if (ticket.data?.status === "error" && ticket.data?.details?.error === "DeviceNotRegistered") {
      await deleteToken(expo_push_token);
    }
  }
}
```

Run this from a Skaftin **server function**, **webhook handler**, or external worker with DB access — not from the mobile client.

### Delivery errors and stale tokens

Expo returns errors per message. Handle at minimum:

| Error | Action |
|-------|--------|
| `DeviceNotRegistered` | Delete token from `device_push_tokens` |
| `MessageTooBig` | Reduce `data` payload (max ~4 KB) |
| `InvalidCredentials` | Fix EAS FCM/APNs credentials (ops, not app code) |

Optionally poll **push receipts** (`https://exp.host/--/api/v2/push/getReceipts`) for delivery confirmation in `notification_log`.

---

## When to send (Rydnex triggers)

Map backend events and schedules to notification types. Existing tables involved:

| Source table | Event | Notification type | Audience |
|--------------|-------|-------------------|----------|
| `part_reminders` | `status` → `warning` or `due`, or `remaining_km` below threshold | `part_reminder` | Vehicle owner (`vehicles.user_id`) |
| `vehicles` | `license_expiry_date` within N days | `license_disk` | Vehicle owner |
| `organisation_join_requests` | New row `status = pending` | `org_join_request` | Organisation admin (`organisations.owner_user_id`) |
| `organisation_join_requests` | `status` → `approved` / `rejected` | `org_request_result` | Requesting driver (`user_id`) |
| `odometer_logs` | Insert causes part reminder recalculation | `part_reminder` | Vehicle owner (event-driven alternative to cron) |

### Scheduled jobs (Skaftin cron)

Use Skaftin stored cron jobs (`create_cron_job` / dashboard) for daily checks:

**Example: license disk expiry (daily 08:00 UTC)**

```sql
-- Pseudologic: select vehicles where license_expiry_date is within 30, 7, or 0 days
-- For each, call sendPushToUser(owner, { notificationType: 'license_disk', referenceId: 'vehicle:' || id })
```

**Example: part reminders (daily)**

```sql
-- Join part_reminders → vehicles
-- Where status IN ('warning', 'due') and not already logged in notification_log for today
```

Cron SQL alone cannot call HTTPS; typical patterns:

1. Cron invokes a Skaftin **HTTP webhook** / serverless function that runs the queries and calls Expo.
2. Cron runs SQL that inserts into a `notification_outbox` table; a worker processes the outbox.

Document the chosen pattern in Skaftin when implemented.

### Event-driven sends

For lower latency (e.g. new org join request), trigger send in the same transaction or immediately after insert:

```
INSERT organisation_join_requests → notify organisations.owner_user_id
```

Recalculate `part_reminders` when `odometer_logs` or `parts_life_rules` change; if status crosses into `warning`/`due`, send once per `reference_id`.

---

## iOS vs Android — backend perspective

From the **backend’s** point of view, iOS and Android are identical: same Expo token format, same send API. Differences are handled on the client and in EAS credentials.

| Topic | iOS | Android |
|-------|-----|---------|
| Token format | `ExponentPushToken[...]` | Same |
| Send API | Expo Push | Expo Push |
| Extra payload fields | Standard | Optional `channelId` for notification channels |
| Permission | User grants in iOS Settings | User grants at runtime; channels created in app |
| Backend branching | Only if recording `platform` for analytics | Same |

Store `platform` on register for debugging and optional channel-specific payloads; do not branch send logic unless you add Android-specific `channelId` values.

---

## Security

1. **Never expose Expo send API calls to the client** — only the backend holds the responsibility to send; tokens are user-specific but abusable if leaked.
2. **Authenticate register/unregister** — bind tokens to the session’s `user_id`.
3. **Do not log full push tokens in production** — truncate in logs.
4. **Validate `data` payloads** — fixed keys (`screen`, `vehicleId`); no arbitrary URLs from user input without allowlisting.
5. **Respect `notification_preferences`** and applicable privacy rules before marketing pushes.
6. **Rate-limit** register endpoint to prevent token flooding.

---

## Mobile client contract (for backend developers)

What the React Native app will do once the backend exists:

1. After login, call `register-token` with the Expo push token.
2. On logout, call `unregister-token`.
3. On app resume, re-register (token may have changed).
4. Listen for notification taps and read `data.screen` / `data.vehicleId` for navigation.

The app obtains the token with:

```typescript
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";

const projectId = Constants.expoConfig?.extra?.eas?.projectId;
const { data: expoPushToken } = await Notifications.getExpoPushTokenAsync({ projectId });
```

Backend does not need to implement APNs/FCM registration — only persist `expoPushToken`.

---

## Testing checklist

| Step | Action |
|------|--------|
| 1 | Create `device_push_tokens` (+ preferences tables) in Skaftin |
| 2 | Implement register / unregister / preferences endpoints |
| 3 | Install dev build on **physical** iOS and Android devices |
| 4 | Login → verify token row in DB with correct `user_id` and `platform` |
| 5 | Send test message via [Expo Push Tool](https://expo.dev/notifications) using stored token |
| 6 | Implement server `sendPushToUser` and trigger one notification from SQL/cron/webhook |
| 7 | Logout → verify token removed |
| 8 | Simulate `DeviceNotRegistered` → verify token pruned |

---

## Implementation order

1. **Schema** — `device_push_tokens`, `notification_preferences`
2. **APIs** — register, unregister, preferences (GET/PATCH)
3. **Send helper** — Expo Push HTTP client + logging + stale token cleanup
4. **One vertical slice** — e.g. `organisation_join_requests` insert → push to admin
5. **Cron** — license disk + part reminders with deduplication via `notification_log`
6. **Mobile integration** — `NotificationService` + `ApiRoutes` entries (separate client task)

---

## Related documentation

- **`firebase-google-cloud-setup.md`** — Firebase project `rydnex-a4ddd`, `google-services.json`, Android FCM
- **`docs/03-database/user-vehicles-and-maintenance.md`** — `vehicles.license_expiry_date`, maintenance tables
- **`docs/03-database/organisations.md`** — join requests and admin resolution
- **`docs/03-features/feature-guide.md`** — Reminders and dashboard alerts (in-app today; push extends these)

---

## Related app files (when client is implemented)

| File | Role |
|------|------|
| `src/constants/ApiRoutes.ts` | Add `notifications.*` routes |
| `src/backend/services/NotificationService.ts` | register / unregister / preferences |
| `src/app/_layout.tsx` | Notification handlers + deep links |
| `app.json` | `expo-notifications` plugin, EAS `projectId` |

---

## Open decisions

Record choices when implementing:

- [ ] Cron + webhook vs `notification_outbox` worker for scheduled sends
- [ ] Dedup window for reminders (once per day vs once per status transition)
- [ ] Whether to support multiple tokens per user without limit or cap per user
- [ ] Local notifications fallback when user denies OS permission (client-only; no backend token)
