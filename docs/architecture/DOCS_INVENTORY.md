# Docs Inventory and Classification

This inventory classifies all docs under `docs/` using deterministic rules and explicit exceptions.

## Classification Labels

- `current`: authoritative and aligned with Go-only runtime
- `merge-target`: useful but should be merged into canonical docs by topic
- `obsolete`: tied to removed Node runtime or superseded architecture

## Deterministic Classification Rules

1. `docs/plans/*.md` -> `obsolete`  
   **Except** canonical exceptions listed below.
2. `docs/client-sdk/**/*.md` -> `merge-target`  
   (candidate to consolidate under `docs/sdk/`)
3. `docs/mcp/*.md` -> `merge-target`  
   (candidate to consolidate under `docs/sdk/` or `docs/architecture/`)
4. `docs/migrations/*.md` -> `current`
5. Root docs:
   - `docs/route-ownership.md` -> `current`
   - `docs/README.md` -> `merge-target` (must stay in sync with canonical set)
   - `docs/app-api-node-go-parity.md` -> `obsolete`
   - `docs/node-go-endpoint-diff.md` -> `obsolete`

## Canonical Exceptions (Rule Overrides)

The following files under `docs/plans/` are currently treated as `current`:

- `docs/plans/GO_GATEWAY_MIGRATION.md`
- `docs/plans/DOCKER_LOCAL_SETUP.md`
- `docs/plans/COOLIFY_QUICKSTART.md`
- `docs/plans/COOLIFY_ENVIRONMENT_SETUP.md`
- `docs/plans/GO_MICROSERVICE_INTEGRATION.md`

## Coverage Statement

Using the rules above plus explicit exceptions, every markdown file currently under `docs/` is classified.

## Immediate Follow-Up

- Move canonical runbooks from `docs/plans/` to `docs/runbooks/`.
- Move client-sdk docs from `docs/client-sdk/` to `docs/sdk/`.
- Remove or archive `obsolete` docs in small batches with link checks.
