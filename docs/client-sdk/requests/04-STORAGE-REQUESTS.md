# Storage Requests (MinIO)

All storage endpoints are available at `/app-api/storage`.

## Base URL
```
/app-api/storage
```

## Authentication
All endpoints require either:
- `x-api-key` header with a valid API key
- `Authorization: Bearer <jwt-token>` header

---

## Bucket Operations

### 1. List Buckets

Get all buckets for the project.

**Endpoint:** `GET /app-api/storage/buckets`

**Headers:**
```
Authorization: Bearer <jwt-token>
```

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| includeStats | string | If `true`, includes `fileCount` and `totalSize` for each bucket |

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "uploads",
      "description": "User uploads bucket",
      "creationDate": "2024-01-15T10:30:00.000Z",
      "updatedAt": "2024-01-15T10:30:00.000Z"
    },
    {
      "id": 2,
      "name": "images",
      "description": "Image assets",
      "creationDate": "2024-01-10T08:00:00.000Z",
      "updatedAt": "2024-01-10T08:00:00.000Z"
    }
  ]
}
```

---

## File Operations

### 2. List Files

Get all files in a bucket.

**Endpoint:** `GET /app-api/storage/:bucketName/files`

**Headers:**
```
Authorization: Bearer <jwt-token>
```

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| prefix | string | Filter files by path prefix |
| maxKeys | number | Maximum files to return (default: 1000) |

**Example:**
```
GET /app-api/storage/uploads/files?prefix=images/&maxKeys=100
```

**Response:**
```json
{
  "success": true,
  "data": {
    "files": [
      {
        "key": "images/logo.png",
        "size": 24576,
        "lastModified": "2024-01-15T10:30:00.000Z",
        "etag": "\"d41d8cd98f00b204e9800998ecf8427e\""
      },
      {
        "key": "images/banner.jpg",
        "size": 102400,
        "lastModified": "2024-01-14T09:15:00.000Z",
        "etag": "\"a87ff679a2f3e71d9181a67b7542122c\""
      }
    ],
    "count": 2,
    "bucket": "uploads"
  }
}
```

---

### 3. Search Files

Search for files in a bucket.

**Endpoint:** `POST /app-api/storage/:bucketName/search`

**Headers:**
```
Content-Type: application/json
Authorization: Bearer <jwt-token>
```

**Request Body:**
```json
{
  "query": "report",
  "fileType": ".pdf",
  "dateRange": {
    "start": "2024-01-01T00:00:00.000Z",
    "end": "2024-01-31T23:59:59.000Z"
  }
}
```

| Field | Type | Description |
|-------|------|-------------|
| query | string | Search query string |
| fileType | string | Filter by file extension |
| dateRange | object | Filter by date range |

**Response:**
```json
{
  "success": true,
  "data": {
    "files": [
      {
        "key": "reports/monthly-report-jan.pdf",
        "size": 512000,
        "lastModified": "2024-01-15T10:30:00.000Z",
        "etag": "\"d41d8cd98f00b204e9800998ecf8427e\""
      }
    ],
    "count": 1,
    "bucket": "uploads"
  }
}
```

---

### 4. Upload File (Base64)

Upload a file using base64 encoding.

**Endpoint:** `POST /app-api/storage/:bucketName/upload`

**Headers:**
```
Content-Type: application/json
Authorization: Bearer <jwt-token>
```

**Request Body:**
```json
{
  "filePath": "documents/report.pdf",
  "fileContent": "JVBERi0xLjQKJeLjz9MKMyAwIG9ia...",
  "contentType": "application/pdf",
  "metadata": {
    "author": "John Doe",
    "department": "Finance"
  }
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| filePath | string | Yes | Path and filename in bucket |
| fileContent | string | Yes | Base64 encoded file content (empty string allowed for folder markers) |
| contentType | string | No | MIME type of the file |
| metadata | object | No | Custom metadata key-value pairs |

**Response (201):**
```json
{
  "success": true,
  "message": "File uploaded successfully",
  "data": {
    "filePath": "documents/report.pdf",
    "size": 512000,
    "contentType": "application/pdf",
    "bucket": "documents"
  }
}
```

---

### 5. Upload File (Multipart Form)

Upload a file using multipart form data (bucket is in the URL).

**Endpoint:** `POST /app-api/storage/:bucketName/upload-multipart`

**Headers:**
```
Authorization: Bearer <jwt-token>
```

**Note:** Do not set `Content-Type` for multipart requests; the client (e.g. cURL with `-F`, or fetch with `FormData`) sets `multipart/form-data; boundary=...` automatically.

**Form Data:**
| Field | Type | Description |
|-------|------|-------------|
| file | File | The file to upload |
| path | string | Optional path prefix |
| metadata | JSON string | Optional metadata |

**cURL Example:**
```bash
curl -X POST "http://localhost:4006/app-api/storage/uploads/upload-multipart" \
  -H "Authorization: Bearer <token>" \
  -F "file=@/path/to/local/file.pdf" \
  -F "path=documents/" \
  -F 'metadata={"author":"John"}'
```

**Response (201):**
```json
{
  "success": true,
  "message": "File uploaded successfully",
  "data": {
    "fileName": "1704067200000-file.pdf",
    "originalName": "file.pdf",
    "size": 512000,
    "contentType": "application/pdf",
    "bucket": "uploads"
  }
}
```

**Note:** The filename is automatically prefixed with a timestamp to ensure uniqueness.

---

### 6. Upload File (Form with Bucket)

Upload a file with bucket and path in form data. Use this when the bucket and path are not in the URL (e.g. dynamic bucket/path from the client).

**Endpoint:** `POST /app-api/storage/files`

**Headers:**
```
Authorization: Bearer <jwt-token>
```

**Important:** For multipart uploads, do **not** set `Content-Type` yourself. Let the client set it automatically to `multipart/form-data; boundary=...` (e.g. when using `FormData` with `fetch`, or cURL’s `-F`). Setting `Content-Type: application/json` or omitting the boundary will cause the request to fail.

**Form Data:**
| Field | Type   | Required | Description           |
|-------|--------|----------|-----------------------|
| file  | File   | Yes      | The file to upload    |
| bucket| string | Yes      | Target bucket name    |
| path  | string | Yes      | Full path in bucket (e.g. `vendors/12/logo.png`) |

**cURL Example:**
```bash
curl -X POST "http://localhost:4006/app-api/storage/files" \
  -H "Authorization: Bearer <token>" \
  -F "file=@/path/to/local/image.png" \
  -F "bucket=images" \
  -F "path=avatars/user-123.png"
```

**JavaScript (fetch + FormData) example:**
```javascript
const formData = new FormData();
formData.append('file', file);        // File from input or Blob
formData.append('bucket', 'images');
formData.append('path', 'vendors/12/logo.png');

// Do NOT set Content-Type header – browser sets multipart/form-data with boundary
const response = await fetch('/app-api/storage/files', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${token}` },
  body: formData,
});
```

**Response (201):**
```json
{
  "success": true,
  "message": "File uploaded successfully",
  "data": {
    "filePath": "vendors/12/logo.png",
    "originalName": "Pasted image.png",
    "size": 24576,
    "contentType": "image/png",
    "bucket": "images"
  }
}
```

---

### 7. Download File

Download a file from storage.

**Endpoint:** `GET /app-api/storage/:bucketName/download/:filePath`

**Headers:**
```
Authorization: Bearer <jwt-token>
```

**Example:**
```
GET /app-api/storage/documents/download/reports/monthly-jan.pdf
```

**Response:** Binary file content with appropriate headers:
```
Content-Type: application/pdf
Content-Disposition: attachment; filename="monthly-jan.pdf"
Content-Length: 512000
```

---

### 8. Download File (Query Parameters)

Download a file using query parameters.

**Endpoint:** `GET /app-api/storage/files/download`

**Headers:**
```
Authorization: Bearer <jwt-token>
```

**Query Parameters:**
| Parameter | Type   | Description |
|-----------|--------|-------------|
| bucket    | string | Bucket name |
| path      | string | File path in bucket (URL-encoded if needed) |
| returnUrl | string | If `true`, returns JSON `{ "url": "<signed-url>" }` instead of redirecting |

**Example (redirect to signed URL):**
```
GET /app-api/storage/files/download?bucket=documents&path=reports/monthly-jan.pdf
```

**Example (get signed URL in response):**
```
GET /app-api/storage/files/download?bucket=documents&path=reports/monthly-jan.pdf&returnUrl=true
```
**Response when returnUrl=true:**
```json
{
  "success": true,
  "message": "Download URL generated",
  "data": { "url": "https://minio.example.com/..." }
}
```

---

### 9. Delete File

Delete a file from storage.

**Endpoint:** `DELETE /app-api/storage/:bucketName/files/:filePath`

**Headers:**
```
Authorization: Bearer <jwt-token>
```

**Example:**
```
DELETE /app-api/storage/documents/files/old-report.pdf
```

**Response:**
```json
{
  "success": true,
  "message": "File deleted successfully",
  "data": {
    "filePath": "old-report.pdf",
    "bucket": "documents"
  }
}
```

---

### 10. Delete File (Request Body)

Delete a file with bucket and path in request body.

**Endpoint:** `DELETE /app-api/storage/files`

**Headers:**
```
Content-Type: application/json
Authorization: Bearer <jwt-token>
```

**Request Body:**
```json
{
  "bucket": "documents",
  "path": "reports/old-report.pdf"
}
```

**Response:**
```json
{
  "success": true,
  "message": "File deleted successfully",
  "data": {
    "filePath": "reports/old-report.pdf",
    "bucket": "documents"
  }
}
```

---

### 11. Get File Metadata

Get metadata for a specific file.

**Endpoint:** `GET /app-api/storage/:bucketName/files/:filePath/metadata`

**Headers:**
```
Authorization: Bearer <jwt-token>
```

**Example:**
```
GET /app-api/storage/documents/files/reports/monthly-jan.pdf/metadata
```

**Response:**
```json
{
  "success": true,
  "data": {
    "filePath": "reports/monthly-jan.pdf",
    "size": 512000,
    "contentType": "application/pdf",
    "lastModified": "2024-01-15T10:30:00.000Z",
    "etag": "\"d41d8cd98f00b204e9800998ecf8427e\"",
    "metadata": {
      "author": "John Doe",
      "department": "Finance"
    },
    "bucket": "documents"
  }
}
```

---

## Folder Operations

### 12. Rename Folder

Rename a folder (moves all files within).

**Endpoint:** `PUT /app-api/storage/:bucketName/folders/rename`

**Headers:**
```
Content-Type: application/json
Authorization: Bearer <jwt-token>
```

**Request Body:**
```json
{
  "oldPath": "documents/2023/",
  "newPath": "documents/archive-2023/"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Folder renamed successfully",
  "data": {
    "oldPath": "documents/2023/",
    "newPath": "documents/archive-2023/",
    "filesRenamed": 15
  }
}
```

---

### 13. Delete Folder

Delete a folder and all its contents.

**Endpoint:** `DELETE /app-api/storage/:bucketName/folders/:folderPath`

**Headers:**
```
Authorization: Bearer <jwt-token>
```

**Example:**
```
DELETE /app-api/storage/documents/folders/old-reports/
```

**Response:**
```json
{
  "success": true,
  "message": "Folder deleted successfully",
  "data": {
    "folderPath": "old-reports/",
    "filesDeleted": 10
  }
}
```

---

## Public API (No User Auth)

These endpoints only require an API key (no user JWT).

### Base URL
```
/app-api-2/storage
```

### Available Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/buckets` | List buckets |
| GET | `/:bucketName/files` | List files |
| POST | `/:bucketName/search` | Search files |
| POST | `/:bucketName/upload` | Upload file (base64) |
| POST | `/:bucketName/upload-multipart` | Upload file (multipart) |
| POST | `/files` | Upload file (form with bucket) |
| GET | `/:bucketName/download/:filePath` | Download file |
| GET | `/files/download` | Download file (query params) |

**Example:**
```bash
curl -X GET "http://localhost:4006/app-api-2/storage/uploads/files" \
  -H "x-api-key: your-api-key"
```

---

## Working with File URLs

### Why Store Paths, Not URLs

Presigned URLs expire (default: 1 hour). **Do not store presigned URLs in your database.** Instead, store the bucket and path, then generate a fresh URL when needed.

**Bad (URL expires):**
```json
{
  "vendorId": 12,
  "logoUrl": "http://localhost:9020/phandapay/vendors/12/logo.png?X-Amz-Algorithm=...&X-Amz-Expires=3600&..."
}
```

**Good (path never expires):**
```json
{
  "vendorId": 12,
  "logoBucket": "phandapay",
  "logoPath": "vendors/12/logo.png"
}
```

### Retrieving a Presigned URL

When you need to display an image or download a file, generate a fresh presigned URL:

**Request:**
```
GET /app-api/storage/files/download?bucket=phandapay&path=vendors/12/logo.png&returnUrl=true
```

**Response:**
```json
{
  "success": true,
  "message": "Download URL generated",
  "data": {
    "url": "http://localhost:9020/phandapay/vendors/12/logo.png?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Expires=3600&..."
  }
}
```

### Example: Displaying a Vendor Logo

**1. Store the path when uploading:**
```javascript
// Upload the file
const formData = new FormData();
formData.append('file', logoFile);
formData.append('bucket', 'phandapay');
formData.append('path', `vendors/${vendorId}/logo.png`);

const uploadRes = await fetch('/app-api/storage/files', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${token}` },
  body: formData,
});

// Save only the path to your database
await saveVendor({
  id: vendorId,
  logoBucket: 'phandapay',
  logoPath: `vendors/${vendorId}/logo.png`
});
```

**2. Retrieve the URL when displaying:**
```javascript
// Get fresh presigned URL
const urlRes = await fetch(
  `/app-api/storage/files/download?bucket=${vendor.logoBucket}&path=${encodeURIComponent(vendor.logoPath)}&returnUrl=true`,
  { headers: { 'Authorization': `Bearer ${token}` } }
);
const { data } = await urlRes.json();

// Use the URL (valid for 1 hour)
const imageUrl = data.url;
```

**3. In React/Vue, fetch URL on component mount:**
```javascript
// React example
const [logoUrl, setLogoUrl] = useState(null);

useEffect(() => {
  if (vendor.logoPath) {
    fetch(`/app-api/storage/files/download?bucket=${vendor.logoBucket}&path=${encodeURIComponent(vendor.logoPath)}&returnUrl=true`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(({ data }) => setLogoUrl(data.url));
  }
}, [vendor.logoBucket, vendor.logoPath]);

return <img src={logoUrl} alt="Vendor logo" />;
```

### Alternative: Direct Download (No URL)

If you don't need the URL (e.g., for direct file downloads), omit `returnUrl`:

```
GET /app-api/storage/files/download?bucket=phandapay&path=vendors/12/logo.png
```

This redirects directly to the file (302 redirect to presigned URL).

---

## Common Use Cases

### Upload Profile Picture

```bash
# Using multipart form
curl -X POST "http://localhost:4006/app-api/storage/avatars/upload-multipart" \
  -H "Authorization: Bearer <token>" \
  -F "file=@profile.jpg" \
  -F "path=users/123/"
```

### Download Invoice

```bash
curl -X GET "http://localhost:4006/app-api/storage/invoices/download/2024/INV-001.pdf" \
  -H "Authorization: Bearer <token>" \
  --output invoice.pdf
```

### List All Images

```bash
curl -X GET "http://localhost:4006/app-api/storage/images/files?prefix=products/" \
  -H "Authorization: Bearer <token>"
```

### Delete Old Files

```bash
curl -X DELETE "http://localhost:4006/app-api/storage/temp/folders/old-uploads/" \
  -H "Authorization: Bearer <token>"
```
