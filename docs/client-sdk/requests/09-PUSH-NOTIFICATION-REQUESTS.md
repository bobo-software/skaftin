# Push Notification Requests (Expo)

Register and unregister **Expo push tokens** for app users so the Skaftin backend can deliver notifications via the [Expo Push API](https://docs.expo.dev/push-notifications/sending-notifications/).

Push must be **enabled** for the project in the Skaftin dashboard (**Communications → Push notifications**). When paused, register and outbound sends return **403**; unregister still works so devices can clean up on logout.

## Base URL

```
/app-api/communications
```

## Authentication

```
Content-Type: application/json
x-api-key: your-api-key
```

The project is resolved from the API key. Optional project-scoped paths also exist:

```
POST   /app-api/communications/{projectId}/push/register
DELETE /app-api/communications/{projectId}/push/unregister
POST   /app-api/communications/{projectId}/push/send
POST   /app-api/communications/{projectId}/push/send-batch
```

When both an API-key project and a path `{projectId}` are present, the **API key project** wins (same as other communications app routes).

Dashboard management (enable/pause, list devices, test send) uses platform JWT under `/api/communications/{projectId}/push/...` and is documented briefly at the end — not for mobile clients.

**Outbound send** (`/push/send`, `/push/send-batch`) is intended for your app backend / server functions using the project API key — not for calling from untrusted mobile clients with the live key embedded.

## Prerequisites

1. Enable push in the dashboard (**Communications → Push notifications** → Enabled).
2. Mobile app obtains an Expo push token (`ExponentPushToken[...]` or `ExpoPushToken[...]`) via `expo-notifications`.
3. Call **register** after login (and when the token rotates / app foregrounds).
4. Call **unregister** on logout.

Multi-device: one row per Expo token. The same `user_id` may have both `ios` and `android` (and multiple devices). Re-registering the same token upserts and reassigns `user_id` if the device logs in as a different user.

---

## 1. Register push token

Store or refresh a device token for a user.

**Endpoint:** `POST /app-api/communications/push/register`

**Headers:**
```
Content-Type: application/json
x-api-key: your-api-key
```

**Request Body:**
```json
{
  "user_id": 42,
  "platform": "ios",
  "expo_push_token": "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]",
  "device_name": "Bob's iPhone"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| user_id | number | Yes | App user id (project schema `skaftin_system_users.id`) |
| platform | string | Yes | `ios` or `android` (case-insensitive) |
| expo_push_token | string | Yes | Expo token; must start with `ExponentPushToken[` or `ExpoPushToken[` |
| device_name | string | No | Optional label from the device |

**Success response:**
```json
{
  "success": true,
  "message": "Push token registered",
  "data": {
    "id": 1,
    "user_id": 42,
    "platform": "ios",
    "expo_push_token": "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]",
    "device_name": "Bob's iPhone",
    "last_seen_at": "2026-07-08T11:00:00Z",
    "created_at": "2026-07-08T11:00:00Z",
    "updated_at": "2026-07-08T11:00:00Z"
  },
  "timestamp": "2026-07-08T11:00:00.000000000Z"
}
```

**Paused project (403):**
```json
{
  "success": false,
  "error": "push notifications are paused for this project",
  "message": "Push notifications are paused for this project"
}
```

**Invalid token / platform (400):**
```json
{
  "success": false,
  "error": "invalid expo push token"
}
```

---

## 2. Unregister push token

Remove a token (e.g. on logout). Allowed even when push is **paused**.

**Endpoint:** `DELETE /app-api/communications/push/unregister`

**Headers:**
```
Content-Type: application/json
x-api-key: your-api-key
```

**Request Body:**
```json
{
  "expo_push_token": "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| expo_push_token | string | Yes | Token to delete |

**Success response:**
```json
{
  "success": true,
  "message": "Push token unregistered",
  "data": {
    "deleted": true
  },
  "timestamp": "2026-07-08T11:00:00.000000000Z"
}
```

`deleted: false` means no matching row (idempotent for clients).

---

## 3. Send push (same payload to many users)

Fan-out one title/body/`data` payload to all registered devices for each `user_id`.

**Endpoint:** `POST /app-api/communications/push/send`

**Request Body:**
```json
{
  "user_ids": [42, 43],
  "title": "Brake pads due soon",
  "body": "Your vehicle is within 500 km of replacement.",
  "data": {
    "screen": "reminders",
    "vehicleId": 42
  },
  "sound": "default"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| user_ids | number[] | Yes | 1–100 positive app user ids (duplicates ignored) |
| title | string | Yes | Notification title |
| body | string | Yes | Notification body |
| data | object | No | Custom JSON for React Native deep linking (forwarded as Expo `data`) |
| sound | string | No | Defaults to `"default"` |

### Deep linking (`data`)

Put a `screen` key (and any ids) in `data`. The mobile app reads this on tap via `expo-notifications` / expo-router. Example:

```json
{ "screen": "reminders", "vehicleId": 42 }
```

Server does not validate `screen` values — keep them JSON-serializable and small.

**Success response:**
```json
{
  "success": true,
  "message": "Push notifications sent",
  "data": {
    "targeted_users": 2,
    "targeted_tokens": 3,
    "sent": 2,
    "skipped_no_tokens": [43],
    "errors": [
      { "token_id": 1, "user_id": 42, "error": "DeviceNotRegistered" }
    ],
    "tickets": []
  },
  "timestamp": "2026-07-08T11:00:00.000000000Z"
}
```

- Users with **no** registered tokens appear in `skipped_no_tokens`.
- If **every** target has no tokens → **404** (`no registered push tokens for the requested target`).
- Expo tickets with `DeviceNotRegistered` prune that token row only.
- Messages are chunked to Expo’s 100-message limit per HTTP call.

---

## 4. Send batch (per-recipient payloads)

Different title/body/`data` per user (still fan-out to all tokens for that user).

**Endpoint:** `POST /app-api/communications/push/send-batch`

**Request Body:**
```json
{
  "notifications": [
    {
      "user_id": 42,
      "title": "Join request",
      "body": "Alex asked to join Fleet A",
      "data": { "screen": "organisation-requests", "requestId": 9 }
    },
    {
      "user_id": 43,
      "title": "License disk",
      "body": "Expires in 7 days",
      "data": { "screen": "license-disk", "vehicleId": 7 }
    }
  ]
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| notifications | array | Yes | 1–100 items |
| notifications[].user_id | number | Yes | App user id |
| notifications[].title | string | Yes | Title |
| notifications[].body | string | Yes | Body |
| notifications[].data | object | No | Deep-link payload |
| notifications[].sound | string | No | Defaults to `"default"` |

**Success response:** same shape as §3 (`targeted_users`, `targeted_tokens`, `sent`, `skipped_no_tokens`, `errors`, `tickets`).

---

## React Native (Expo) example

```typescript
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { router } from 'expo-router';

const API_BASE = 'https://your-backend.com/app-api';
const API_KEY = 'your-api-key';

async function getExpoPushToken(): Promise<string | null> {
  if (!Device.isDevice) return null;
  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;
  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') return null;

  const token = (
    await Notifications.getExpoPushTokenAsync({
      projectId: 'your-eas-project-id',
    })
  ).data;
  return token;
}

export async function registerPushForUser(userId: number) {
  const expoPushToken = await getExpoPushToken();
  if (!expoPushToken) return;

  const platform = Platform.OS === 'ios' ? 'ios' : 'android';
  const res = await fetch(`${API_BASE}/communications/push/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
    },
    body: JSON.stringify({
      user_id: userId,
      platform,
      expo_push_token: expoPushToken,
      device_name: Device.modelName ?? undefined,
    }),
  });
  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.error || json.message || 'Failed to register push token');
  }
  return json.data;
}

export async function unregisterPushToken(expoPushToken: string) {
  const res = await fetch(`${API_BASE}/communications/push/unregister`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
    },
    body: JSON.stringify({ expo_push_token: expoPushToken }),
  });
  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.error || json.message || 'Failed to unregister push token');
  }
  return json.data;
}

/** Call from a trusted backend with the project API key — not from the mobile app. */
export async function sendPushToUsers(params: {
  userIds: number[];
  title: string;
  body: string;
  data?: Record<string, unknown>;
}) {
  const res = await fetch(`${API_BASE}/communications/push/send`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
    },
    body: JSON.stringify({
      user_ids: params.userIds,
      title: params.title,
      body: params.body,
      data: params.data,
    }),
  });
  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.error || json.message || 'Failed to send push');
  }
  return json.data;
}

/** Navigate when the user taps a notification that includes data.screen. */
export function handleNotificationDeepLink(data: Record<string, unknown> | undefined) {
  const screen = typeof data?.screen === 'string' ? data.screen : null;
  if (!screen) return;
  // Map screen keys to your expo-router paths.
  switch (screen) {
    case 'reminders':
      router.push('/reminders');
      break;
    case 'license-disk':
      router.push('/log/license-disk');
      break;
    default:
      break;
  }
}
```

Call `registerPushForUser` after a successful login (and again on app resume if needed). Call `unregisterPushToken` before clearing the session on logout. Wire `handleNotificationDeepLink` from `Notifications.addNotificationResponseReceivedListener` (and cold-start `getLastNotificationResponseAsync`).

---

## Dashboard / server-side routes (reference)

These require a **platform JWT** and project access (Skaftin admin UI), not the mobile API key flow:

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/communications/{projectId}/push/settings` | Ensure token table; return `{ is_active, ... }` |
| PUT | `/api/communications/{projectId}/push/settings` | Body `{ "is_active": true \| false }` — pause never deletes tokens |
| GET | `/api/communications/{projectId}/push/tokens` | List registered devices (token preview truncated) |
| POST | `/api/communications/{projectId}/push/test` | Body `{ "user_id"? , "token_id"? , "title"? , "body"? }` — send via Expo when enabled |

Test send requires `user_id` and/or `token_id`. Stale Expo tickets with `DeviceNotRegistered` remove that token row only (pruning), not the project enable flag.

---

## Error summary

| HTTP | When |
|------|------|
| 400 | Missing/invalid fields (`user_id`, `user_ids`, `title`, `body`, `platform`, `expo_push_token`, over-limit arrays) |
| 403 | Push paused (`is_active: false`) on register or send |
| 404 | Send/test target has no tokens for any requested user |
| 500 | Unexpected server / database / Expo API error |

---

## Related

- Communications (email / SMS / WhatsApp): [06-COMMUNICATIONS-REQUESTS.md](./06-COMMUNICATIONS-REQUESTS.md)
- Backend plan notes (Rydnex triggers, prefs — future): [`docs/plans/push-notifications-backend.md`](../../plans/push-notifications-backend.md)
