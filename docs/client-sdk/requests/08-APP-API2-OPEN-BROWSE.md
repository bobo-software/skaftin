# App-API2 Open Browse Requests

Read-only client surface for shop/catalog browsing **without app-user login**. End users do not need a SuperTokens session; your app still authenticates to Skaftin with **two platform credentials**.

## Base URL

```
/app-api2
```

Distinct from `/app-api` (full client API) and the removed legacy `/app-api-2` path.

## Authentication (both required)

Every `/app-api2` request must include **both** headers:

```
X-API-Key: sk_your_api_key
Authorization: Bearer sat_your_access_token
Content-Type: application/json
```

| Credential | Header | Type | Role |
|------------|--------|------|------|
| API key | `X-API-Key` | `api_key` (`sk_...`) | Identifies the project |
| Access token | `Authorization: Bearer` | `access_token` (`sat_...`) | Supplies permissions |

Both credentials must belong to the **same project**. Permissions are enforced from the access token:

| Route | Required permission |
|-------|-------------------|
| `POST .../database/tables/{table}/select` | `database:read` |
| `GET .../storage/files/download` | `storage:read` |

Create credentials in **Settings → API Credentials** in the Skaftin dashboard. Use a read-scoped access token for browse-only clients.

## Supported endpoints

Only these operations are mounted under `/app-api2`:

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/app-api2/database/tables/{tableName}/select` | Query table rows |
| `GET` | `/app-api2/storage/files/download` | Download file or get presigned URL |

All insert, update, delete, schema, cron, upload, and list-bucket routes are **not** available on this surface.

---

## Database: POST select

Query rows from a project table. Project context comes from the API key (no `projectId` in the URL).

### Request

```
POST /app-api2/database/tables/{tableName}/select
```

**Body (JSON):**

| Field | Type | Description |
|-------|------|-------------|
| `columns` | `string[]` | Optional column list; default `*` |
| `where` | `object` | Optional equality filters (`column: value`) |
| `limit` | `number` | Optional row cap; **defaults to 100** when omitted |
| `offset` | `number` | Optional pagination offset |
| `orderBy` | `string` | Sort column; default `id` |
| `orderDirection` | `string` | `ASC` or `DESC`; default `ASC` |

**Not supported on this surface:** `decrypt` — field decryption returns `403`.

### Example

```bash
curl -X POST "https://skaftinplatform.bobosoftware.co.za/app-api2/database/tables/companies/select" \
  -H "X-API-Key: sk_your_api_key" \
  -H "Authorization: Bearer sat_your_access_token" \
  -H "Content-Type: application/json" \
  -d '{
    "where": { "is_published": true },
    "columns": ["id", "name", "logo_path"],
    "limit": 50,
    "orderBy": "name",
    "orderDirection": "ASC"
  }'
```

### Response

```json
{
  "success": true,
  "message": "Data fetched successfully",
  "data": [
    { "id": 1, "name": "Acme Co", "logo_path": "6/company_logo.png" }
  ]
}
```

---

## Storage: GET download

Download a file or obtain a presigned URL. The bucket must belong to the project (from API key) and have **`access_policy: public`** in project bucket settings.

### Request

```
GET /app-api2/storage/files/download?bucket={bucketName}&path={filePath}&returnUrl=true
```

| Query param | Required | Description |
|-------------|----------|-------------|
| `bucket` | Yes | Project bucket name |
| `path` | Yes | Object path within the bucket (URL-encoded allowed) |
| `returnUrl` | No | `true` returns JSON with presigned URL; omit to redirect |

### Example (presigned URL)

```bash
curl "https://skaftinplatform.bobosoftware.co.za/app-api2/storage/files/download?bucket=foroman&path=6%2Fcompany_logo.png&returnUrl=true" \
  -H "X-API-Key: sk_your_api_key" \
  -H "Authorization: Bearer sat_your_access_token"
```

### Response (`returnUrl=true`)

```json
{
  "success": true,
  "message": "Download URL generated",
  "data": {
    "url": "https://..."
  }
}
```

---

## Error responses

| Status | Typical cause |
|--------|----------------|
| `401` | Missing `X-API-Key` or `Authorization: Bearer` |
| `403` | Invalid/inactive/expired credential; wrong credential type; API key and access token from different projects; missing `database:read` / `storage:read`; private bucket on download; `decrypt` in select body |
| `404` | Unknown `/app-api2` path; bucket/file not found |
| `400` | Missing `bucket`/`path`; project not found |

Unknown paths under `/app-api2/` return the standard Go JSON 404 envelope.

---

## Security notes

- Use a **read-scoped access token** (`database:read`, `storage:read` only) in client apps.
- Prefer a **BFF/server** to hold credentials in production rather than embedding both tokens in a public SPA bundle.
- Mark catalog asset buckets as **public** in project storage settings; keep private buckets off this surface.
- Filter public catalog data in `where` clauses (e.g. `is_published: true`); row-level rules are your app’s responsibility.

## Related docs

- [03-DATABASE-REQUESTS.md](./03-DATABASE-REQUESTS.md) — full `/app-api/database` API
- [04-STORAGE-REQUESTS.md](./04-STORAGE-REQUESTS.md) — full `/app-api/storage` API
- [02-AUTHENTICATION.md](../02-AUTHENTICATION.md) — credential types and permissions
