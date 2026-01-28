# Client SDK API Requests

This folder contains documentation for all API requests that client applications can make to the Skaftin platform.

## Base URLs

| API Type | Base URL | Authentication |
|----------|----------|----------------|
| Client API | `/app-api` | API Key or App User JWT |
| Public API | `/app-api-2` | API Key only (no user auth) |
| GraphQL | `/api/graphql` | SuperTokens session |

## Authentication Headers

```
x-api-key: your-api-key
# OR
Authorization: Bearer <jwt-token>
```

## Available Request Categories

| Document | Description |
|----------|-------------|
| [01-AUTH-REQUESTS.md](./01-AUTH-REQUESTS.md) | User authentication (login, register, OTP, password reset) |
| [02-USER-REQUESTS.md](./02-USER-REQUESTS.md) | User CRUD operations and role management |
| [03-DATABASE-REQUESTS.md](./03-DATABASE-REQUESTS.md) | Database table operations (CRUD, schema, constraints) |
| [04-STORAGE-REQUESTS.md](./04-STORAGE-REQUESTS.md) | MinIO storage operations (files, buckets) |
| [05-GRAPHQL-REQUESTS.md](./05-GRAPHQL-REQUESTS.md) | GraphQL queries and mutations |
| [06-COMMUNICATIONS-REQUESTS.md](./06-COMMUNICATIONS-REQUESTS.md) | Email and SMS operations |

## Quick Reference

### Authentication Flow
```
1. Register → POST /app-api/auth/register
2. Login → POST /app-api/auth/login
3. Use JWT token in subsequent requests
```

### Common Response Format
```json
{
  "success": true,
  "message": "Operation successful",
  "data": { ... }
}
```

### Error Response Format
```json
{
  "success": false,
  "message": "Error message",
  "error": "Detailed error info"
}
```
