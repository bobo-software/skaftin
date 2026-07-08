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
```

When both an API-key project and a path `{projectId}` are present, the **API key project** wins (same as other communications app routes).

Dashboard management (enable/pause, list devices, test send) uses platform JWT under `/api/communications/{projectId}/push/...` and is documented briefly at the end — not for mobile clients.

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

## React Native (Expo) example

```typescript
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

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
```

Call `registerPushForUser` after a successful login (and again on app resume if needed). Call `unregisterPushToken` before clearing the session on logout.

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
| 400 | Missing/invalid `user_id`, `platform`, or `expo_push_token` |
| 403 | Push paused (`is_active: false`) on register or test send |
| 404 | Test send target has no tokens |
| 500 | Unexpected server / database error |

---

## Related

- Communications (email / SMS / WhatsApp): [06-COMMUNICATIONS-REQUESTS.md](./06-COMMUNICATIONS-REQUESTS.md)
- Backend plan notes (Rydnex triggers, prefs — future): [`docs/plans/push-notifications-backend.md`](../../plans/push-notifications-backend.md)
