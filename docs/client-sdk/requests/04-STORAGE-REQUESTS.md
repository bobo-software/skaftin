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

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "name": "uploads",
      "creationDate": "2024-01-15T10:30:00.000Z"
    },
    {
      "name": "images",
      "creationDate": "2024-01-10T08:00:00.000Z"
    },
    {
      "name": "documents",
      "creationDate": "2024-01-05T14:20:00.000Z"
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
        "name": "images/logo.png",
        "size": 24576,
        "lastModified": "2024-01-15T10:30:00.000Z",
        "etag": "\"d41d8cd98f00b204e9800998ecf8427e\""
      },
      {
        "name": "images/banner.jpg",
        "size": 102400,
        "lastModified": "2024-01-14T09:15:00.000Z",
        "etag": "\"a87ff679a2f3e71d9181a67b7542122c\""
      }
    ],
    "isTruncated": false,
    "keyCount": 2
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
        "name": "reports/monthly-report-jan.pdf",
        "size": 512000,
        "lastModified": "2024-01-15T10:30:00.000Z"
      }
    ],
    "totalResults": 1
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
  "fileName": "documents/report.pdf",
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
| fileName | string | Yes | Path and filename in bucket |
| fileContent | string | Yes | Base64 encoded file content |
| contentType | string | No | MIME type of the file |
| metadata | object | No | Custom metadata key-value pairs |

**Response:**
```json
{
  "success": true,
  "message": "File uploaded successfully",
  "data": {
    "fileName": "documents/report.pdf",
    "size": 512000,
    "etag": "\"d41d8cd98f00b204e9800998ecf8427e\"",
    "url": "https://minio.example.com/project-bucket/documents/report.pdf"
  }
}
```

---

### 5. Upload File (Multipart Form)

Upload a file using multipart form data.

**Endpoint:** `POST /app-api/storage/:bucketName/upload-multipart`

**Headers:**
```
Content-Type: multipart/form-data
Authorization: Bearer <jwt-token>
```

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

---

### 6. Upload File (Form with Bucket)

Upload a file with bucket and path in form data.

**Endpoint:** `POST /app-api/storage/files`

**Headers:**
```
Content-Type: multipart/form-data
Authorization: Bearer <jwt-token>
```

**Form Data:**
| Field | Type | Description |
|-------|------|-------------|
| file | File | The file to upload |
| bucket | string | Target bucket name |
| path | string | File path in bucket |

**cURL Example:**
```bash
curl -X POST "http://localhost:4006/app-api/storage/files" \
  -H "Authorization: Bearer <token>" \
  -F "file=@/path/to/local/image.png" \
  -F "bucket=images" \
  -F "path=avatars/user-123.png"
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
| Parameter | Type | Description |
|-----------|------|-------------|
| bucket | string | Bucket name |
| path | string | File path in bucket |

**Example:**
```
GET /app-api/storage/files/download?bucket=documents&path=reports/monthly-jan.pdf
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
  "message": "File deleted successfully"
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
    "fileName": "reports/monthly-jan.pdf",
    "size": 512000,
    "contentType": "application/pdf",
    "lastModified": "2024-01-15T10:30:00.000Z",
    "etag": "\"d41d8cd98f00b204e9800998ecf8427e\"",
    "metadata": {
      "author": "John Doe",
      "department": "Finance"
    }
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
| GET | `/:bucketName/download/:filePath` | Download file |

**Example:**
```bash
curl -X GET "http://localhost:4006/app-api-2/storage/uploads/files" \
  -H "x-api-key: your-api-key"
```

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
