# Phase Execution Checklist

This checklist is designed for small, low-risk PRs while restructuring folders and pruning docs.

## Phase 1: Docs Inventory and Canonicalization

- [ ] Confirm canonical docs list (architecture + runbooks + route ownership).
- [ ] Apply classification rules from `DOCS_INVENTORY.md`.
- [ ] Ensure `docs/README.md` links only canonical/current docs.
- [ ] Validate no CI/deploy doc references to Node runtime.

## Phase 2: Aggressive Docs Prune

- [ ] Delete obsolete root docs:
  - `docs/app-api-node-go-parity.md`
  - `docs/node-go-endpoint-diff.md`
- [ ] Prune `docs/plans/` in batches by feature area.
- [ ] Keep only approved current exceptions.
- [ ] Run link/reference scan and fix internal links.

## Phase 3: Scripts Restructure

- [ ] Create `scripts/migrations`, `scripts/ops/local`, `scripts/ops/prod`.
- [ ] Move files according to `SCRIPTS_REORG_MATRIX.md`.
- [ ] Add `scripts/README.md` with risk warnings and usage examples.
- [ ] Update root script commands in `package.json` to new paths.

## Phase 4: Final Consistency Pass

- [ ] Verify CI workflow still builds only frontend + go-service images.
- [ ] Verify `docker-compose.yml` remains Go-only backend runtime.
- [ ] Verify Go tests pass (`go test ./...`).
- [ ] Verify docs index is accurate and minimal.

## Acceptance Criteria

- No operational runner references to retired Node backend runtime.
- Docs are navigable with one clear canonical path per topic.
- Scripts are grouped by intent and risk.
- Refactor is done via small, reviewable PRs without runtime regressions.
