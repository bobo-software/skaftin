# Scripts Reorganization Matrix

## Goal

Reorganize root scripts by risk and purpose without changing script behavior in the same phase.

## Target Structure

```text
scripts/
  migrations/
  ops/
    local/
    prod/
```

## Safety Labels

- `local-only`: safe for developer machines and test environments
- `prod-risk`: touches production data, credentials, or permissions
- `migration`: schema/data evolution scripts that must remain auditable

## Move Matrix

| Current Path | Target Path | Label | Notes |
|---|---|---|---|
| `scripts/run-migration.ts` | `scripts/migrations/run-migration.ts` | migration | Canonical migration runner. |
| `scripts/run-migration-0025.ts` | `scripts/migrations/run-migration-0025.ts` | migration | Keep historical mapping. |
| `scripts/run-migration-0026.ts` | `scripts/migrations/run-migration-0026.ts` | migration | Keep historical mapping. |
| `scripts/run-migration-0027.ts` | `scripts/migrations/run-migration-0027.ts` | migration | Keep historical mapping. |
| `scripts/run-migration-0029.ts` | `scripts/migrations/run-migration-0029.ts` | migration | Keep historical mapping. |
| `scripts/migrate-email-nullable.ts` | `scripts/migrations/migrate-email-nullable.ts` | migration | Data migration scope. |
| `scripts/add-password-column.ts` | `scripts/migrations/add-password-column.ts` | migration | Schema evolution. |
| `scripts/add-bucket-access-policy-column.ts` | `scripts/migrations/add-bucket-access-policy-column.ts` | migration | Schema evolution. |
| `scripts/check-table-schema.ts` | `scripts/ops/local/check-table-schema.ts` | local-only | Inspection utility. |
| `scripts/delete-minio-bucket.ts` | `scripts/ops/prod/delete-minio-bucket.ts` | prod-risk | Destructive storage action. |
| `scripts/set-minio-buckets-public.ts` | `scripts/ops/prod/set-minio-buckets-public.ts` | prod-risk | Bucket policy mutation. |
| `scripts/fix-org-membership-production.ts` | `scripts/ops/prod/fix-org-membership-production.ts` | prod-risk | Explicit production mutation. |
| `scripts/create-admin-user-production.ts` | `scripts/ops/prod/create-admin-user-production.ts` | prod-risk | Admin privilege mutation. |
| `scripts/add-user-to-org-via-mcp.ts` | `scripts/ops/prod/add-user-to-org-via-mcp.ts` | prod-risk | User/org mutation. |
| `scripts/create-user-with-project-access.ts` | `scripts/ops/local/create-user-with-project-access.ts` | local-only | Useful in local/test setup. |

## Guardrails

- Add `scripts/README.md` with:
  - required env vars
  - destructive script warnings
  - approval expectations for prod-risk scripts
- Keep old npm aliases temporarily (one release) with deprecation notes.
- Move in one PR, then update package scripts and docs in a follow-up PR.
