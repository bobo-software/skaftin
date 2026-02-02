# Client notes: POST /app-api/storage/files (multipart upload)

If you see **"Cannot read properties of undefined (reading 'bucket')"** or the server fails to parse the form, the request body is not being parsed as multipart. That usually means the request is missing the correct `Content-Type` header.

## What the client must do

1. **Do NOT set `Content-Type` when using `FormData` (browser fetch)**  
   The browser will set it to `multipart/form-data; boundary=...` automatically. If you set it manually (e.g. to `multipart/form-data` without the boundary), the server cannot parse the body and `req.body` stays undefined.

2. **If you use axios or another client**  
   - Either do not set `Content-Type` and let the client set it from the body, or  
   - Set it only if you can include the correct boundary (e.g. from the FormData boundary).

3. **If the request goes through a proxy (nginx, Cloudflare, etc.)**  
   Ensure the proxy does **not** strip or overwrite the request `Content-Type` for `POST /app-api/storage/files`. The server needs the full header: `multipart/form-data; boundary=----...`.

## Correct example (browser fetch)

```javascript
const formData = new FormData();
formData.append('file', file);
formData.append('bucket', bucketName);
formData.append('path', filePath);

// Only Authorization – do NOT set Content-Type
const response = await fetch('/app-api/storage/files', {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}` },
  credentials: 'include',
  body: formData,
});
```

## What to check when it fails

- In DevTools → Network, select the failing request and check **Request Headers**.  
  You should see: `Content-Type: multipart/form-data; boundary=----WebKitFormBoundary...` (or similar).  
  If you see `Content-Type: application/json` or no `Content-Type`, fix the client or proxy so the correct multipart header is sent.
