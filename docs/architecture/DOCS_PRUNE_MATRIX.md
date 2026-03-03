# Docs Prune Matrix (Aggressive)

This matrix defines file-level action policy for pruning legacy docs while preserving operational safety.

## Keep (Current / Authoritative)

| Path | Action | Reason |
|---|---|---|
| `docs/route-ownership.md` | Keep | Canonical ownership contract for routes. |
| `docs/plans/GO_GATEWAY_MIGRATION.md` | Keep (short-term) | Active migration reference for Go cutover context. |
| `docs/plans/DOCKER_LOCAL_SETUP.md` | Keep (short-term) | Active local operational runbook. |
| `docs/plans/COOLIFY_QUICKSTART.md` | Keep (short-term) | Active deploy quickstart. |
| `docs/plans/COOLIFY_ENVIRONMENT_SETUP.md` | Keep (short-term) | Active env reference. |
| `docs/plans/GO_MICROSERVICE_INTEGRATION.md` | Keep (short-term) | Current integration summary, post-cutover rewrite. |
| `docs/migrations/*.md` | Keep | Migration history is still useful and low-noise. |

## Merge Targets (Consolidate, Then Remove Originals)

| Source Scope | Merge Destination | Action |
|---|---|---|
| `docs/client-sdk/**/*.md` | `docs/sdk/` | Merge by topic, then remove duplicates/summaries. |
| `docs/mcp/*.md` | `docs/architecture/` or `docs/sdk/` | Merge tooling docs into canonical sections. |
| `docs/README.md` | `docs/README.md` (refresh index only) | Keep file, prune links to obsolete docs. |

## Delete Aggressively (Node-Era / Superseded)

Delete files where primary value depends on removed Node runtime concepts:

- any doc centered on `src/Server.ts`
- any doc centered on `node-backend`, `NODE_BACKEND_URL`, `AUTO_START_NODE`
- any doc prescribing Node runtime setup (`nodemon`, root backend Dockerfile)
- duplicate feature summaries that only repeat completed implementation logs

### Immediate Obsolete Roots

| Path | Action | Reason |
|---|---|---|
| `docs/app-api-node-go-parity.md` | Delete | Superseded by Go route ownership and strict no-fallback model. |
| `docs/node-go-endpoint-diff.md` | Delete | Diff doc is stale after full ownership transfer. |

### Immediate Obsolete Plans Bucket

Policy:
- treat `docs/plans/*.md` as delete candidates by default
- keep only files listed in the **Keep** section above
- run batched deletion by functional area to avoid accidental link breakage

## Deletion Sequencing

1. Remove obsolete root docs (`app-api-node-go-parity`, `node-go-endpoint-diff`).
2. For each feature area in `docs/plans/`, keep one canonical guide or delete all if superseded.
3. Re-run docs link scan and update `docs/README.md`.
4. Remove stale references in CI/deploy/runbook docs.
