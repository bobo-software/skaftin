# Skaftin Documentation

This repository now runs with a Go-only backend runtime (`go-services`) and a React frontend (`frontend`).

## Start Here

- Runtime ownership: [route-ownership.md](./route-ownership.md)
- Local Docker setup: [plans/DOCKER_LOCAL_SETUP.md](./plans/DOCKER_LOCAL_SETUP.md)
- Coolify quick deploy: [plans/COOLIFY_QUICKSTART.md](./plans/COOLIFY_QUICKSTART.md)
- Go migration/cutover context: [plans/GO_GATEWAY_MIGRATION.md](./plans/GO_GATEWAY_MIGRATION.md)
- Startup migration behavior: [migrations/startup-migrations.md](./migrations/startup-migrations.md)

## Architecture and Restructure Artifacts

- Folder blueprint: [architecture/STRUCTURE_BLUEPRINT.md](./architecture/STRUCTURE_BLUEPRINT.md)
- Docs inventory: [architecture/DOCS_INVENTORY.md](./architecture/DOCS_INVENTORY.md)
- Docs prune matrix: [architecture/DOCS_PRUNE_MATRIX.md](./architecture/DOCS_PRUNE_MATRIX.md)
- Scripts reorg matrix: [architecture/SCRIPTS_REORG_MATRIX.md](./architecture/SCRIPTS_REORG_MATRIX.md)
- Phase checklist: [architecture/PHASE_CHECKLIST.md](./architecture/PHASE_CHECKLIST.md)

## SDK and Integration Docs

- Client SDK index: [client-sdk/README.md](./client-sdk/README.md)
- MCP docs:
  - [mcp/AUTH_TOOLS.md](./mcp/AUTH_TOOLS.md)
  - [mcp/AUTH_TOOLS_QUICKSTART.md](./mcp/AUTH_TOOLS_QUICKSTART.md)
  - Cron (stored job definitions): MCP tools `list_cron_jobs`, `create_cron_job`, `update_cron_job`, `delete_cron_job`, `toggle_cron_job`, `get_cron_job_history` live in `go-services/internal/mcp/tools_database.go`. On the **client** MCP endpoint, `projectId` is optional and taken from the API key / auth context (if you pass `projectId`, it must match the token). On **admin** MCP, `projectId` is required in tool arguments.

## Notes

- `docs/plans/` currently contains many legacy and historical documents.
- Use the inventory and prune matrix above before treating `plans/*` as canonical.
- Runtime SQL files for general migration tooling live in `go-services/migrations/`.
- API and MCP startup run an ordered allowlist of idempotent migrations from `go-services/internal/startup/sql/` (embedded), then validate required `public` tables before listening.
- Project database cron jobs (`skaftin_app_cron_jobs`) are executed server-side by the Go API on a 30s UTC tick; the dashboard cron page is management/history UI and no longer drives execution.

