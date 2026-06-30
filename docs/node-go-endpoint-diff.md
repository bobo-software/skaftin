# Node vs Go Endpoint Diff

This file captures the endpoint groups that were Node-owned at migration start and their Go migration target.

## Previously Node-owned groups

- `/app-api/database/*` -> served by Go (`internal/dbproxy`).
- `/app-api/storage/*` -> served by Go (`internal/storage`).
- `/app-api/request-logs/*` -> now served by Go (`POST /{projectId}` create-log compatibility).
- `/app-api/communications/*` -> now served by Go using communications compatibility routes.
- `/app-api/payments/*` -> now served by Go using app-api payment compatibility handlers.
- `/app-api/auth/*` (except `/auth/*` SuperTokens core) -> now served by Go using app-api auth compatibility routing.

## Intentionally still Node-owned

- `/auth/*` (SuperTokens middleware endpoints).
- `/socket.io/*` realtime gateway/protocol.
