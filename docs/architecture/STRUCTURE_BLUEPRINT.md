# Go-Only Folder Structure Blueprint

## Objective

Make repository structure explicit for a Go-only backend runtime while keeping migration risk low and reviewable.

## Target Repository Layout

```text
skaftin/
  .github/
    workflows/
      docker-image.yml
  go-services/                  # Primary backend runtime (Go)
    cmd/
    internal/
    Dockerfile
  frontend/                     # React/Vite frontend
    src/
    Dockerfile
  docs/
    README.md                   # Canonical docs index
    architecture/               # System design, ownership, blueprint/matrices
    runbooks/                   # Local/dev/prod operational guides
    sdk/                        # Client SDK/integration docs
    mcp/                        # MCP docs
    migrations/                 # Migration notes
    archive/                    # Historical docs retained only if needed
  scripts/
    migrations/
    ops/
      local/
      prod/
  migrations/                   # SQL migrations consumed at runtime
  database/
    init/
  docker-compose.yml
```

## Ownership Rules

- `go-services/` is the only backend application runtime.
- `frontend/` owns UI/client code only.
- `docs/` should separate:
  - architecture truth
  - operational runbooks
  - SDK usage
  - historical/archive
- `scripts/` should separate:
  - schema/data migrations
  - local ops helpers
  - production ops helpers

## Naming Conventions

- Prefer domain-based names over technology-era names.
  - Example: `APP_ROOT_DIR` instead of `NODE_WORK_DIR`.
- Use consistent backend naming in docs and CI:
  - `go-service` image/service naming
  - no runtime references to `node-backend`

## Canonical Runtime Files

- CI build pipeline: `/.github/workflows/docker-image.yml`
- Local stack: `/docker-compose.yml`
- Route ownership: `/docs/route-ownership.md`
- Deploy/local runbooks:
  - `/docs/plans/COOLIFY_QUICKSTART.md`
  - `/docs/plans/DOCKER_LOCAL_SETUP.md`

## Non-Goals for This Phase

- No broad code moves across frontend/go folders.
- No mass deletion of all historical docs in one PR.
- No behavior change to auth, API, or deployment runtime.
