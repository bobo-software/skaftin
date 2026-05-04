# Local Docker configuration

This document describes the **local** Docker stack defined in the repository root `docker-compose.yml`: which containers run, how they connect, and how to bring the stack up (including staying on current image versions).

## Prerequisites

- **Docker Engine** (recent release; Compose V2 is bundled as `docker compose`).
- **Ports free on the host:** `3567`, `4006`, `5440`, `9020`, `9021` (or change the published ports in `docker-compose.yml`).
- **Compose file:** `docker-compose.yml` at the repository root (`version: '3.8'`).

## Services overview

When you run `docker compose up -d` from the repo root, these **four** services start on the shared bridge network `skaftin-network`:

| Service (compose key) | Container name           | Image / build                         | Host ports (→ container) | Role |
|------------------------|--------------------------|----------------------------------------|---------------------------|------|
| `postgres`             | `skaftin-postgres`       | `postgres:17-alpine`                   | `5440` → `5432`           | Primary PostgreSQL database (`skaftin_db`). |
| `minio`                | `skaftin-minio`          | `minio/minio:latest`                   | `9020` → `9000`, `9021` → `9001` | S3-compatible object storage (API + console). |
| `supertokens`          | `skaftin-supertokens`    | `registry.supertokens.io/supertokens/supertokens-postgresql:10.0` | `3567` → `3567` | SuperTokens Core (auth/session), using PostgreSQL. |
| `go-service`           | `skaftin-go-service`     | Build: `./go-services` (`Dockerfile`) | `4006` → `4006`           | Go API gateway (main backend for local Docker). |

**Not in Compose:** the **frontend** is not started by this file. For day-to-day UI work, run it on the host (`cd frontend && npm run dev`, typically `http://localhost:3005`). A production-style frontend image exists at `frontend/Dockerfile` (nginx) but is optional for local full-stack Docker.

### Persistent data

Named volumes (data survives `docker compose down` unless you remove volumes):

- `postgres-data` → PostgreSQL data directory  
- `minio-data` → MinIO object store  

## Network and environment

- **Network:** `skaftin-network` (bridge). Services reach each other by **service name** (`postgres`, `minio`, `supertokens`, `go-service`).
- **Database URL inside the stack:** the Go service uses `DB_HOST=postgres`, `DB_PORT=5432`. SuperTokens uses a PostgreSQL connection URI pointing at `postgres:5432` (password must be URL-encoded where required, as in compose).
- **SuperTokens:** `go-service` sets `SUPERTOKENS_CORE_URL=http://supertokens:3567`. Optionally align `SUPERTOKENS_API_KEY` with the Core `API_KEYS` value via a root `.env` file and `${SUPERTOKENS_API_KEY}` in compose. If the Go API (or MCP) runs **startup migrations** that touch `supertokens.*` while Core is already running, restart Core once so it reloads tenant metadata from Postgres (`docker restart skaftin-supertokens`), or wait for the next internal sync. Details: [`docs/migrations/startup-migrations.md`](migrations/startup-migrations.md#supertokens-core-and-tenant-cache).
- **MinIO:** `go-service` uses `MINIO_ENDPOINT=minio:9000` and the same access/secret keys as the MinIO service.

Credentials and defaults are defined in `docker-compose.yml`. For anything beyond a disposable local machine, replace hard-coded passwords and keys and use env files or secrets (do not commit real production values).

## Health checks

Compose defines healthchecks for `postgres`, `supertokens`, `minio`, and `go-service`. The Go service waits for **Postgres** to be healthy before starting; allow a short time after `up` for SuperTokens to finish migrations against Postgres.

Verify:

```bash
curl -sS http://localhost:4006/api/v2/health
curl -sS http://localhost:3567/hello
```

## Replicate the stack (clean run)

From the repository root:

```bash
docker compose pull          # refresh pullable images
docker compose build --no-cache go-service   # optional: rebuild Go binary image
docker compose up -d
docker compose ps
docker compose logs -f --tail=100
```

Tear down (keep volumes):

```bash
docker compose down
```

Tear down **and delete** Postgres + MinIO data:

```bash
docker compose down -v
```

## Using newer / “latest” image versions

1. **PostgreSQL**  
   - Compose uses `postgres:17-alpine`. To move to a newer **patch** of 17, run `docker compose pull postgres`.  
   - To try a newer **major** (e.g. 18 when available), change the tag in `docker-compose.yml`, pull, and run migrations/backups as required by PostgreSQL release notes.

2. **MinIO**  
   - Already `minio/minio:latest`. `docker compose pull minio` updates to the newest published `latest`. For reproducible builds, pin a specific release tag from [MinIO container releases](https://hub.docker.com/r/minio/minio/tags).

3. **SuperTokens Core**  
   - Currently pinned to `supertokens-postgresql:10.0`. Check [SuperTokens Docker / changelog](https://supertokens.com/docs) for newer compatible tags; update the image line, pull, and verify auth flows after upgrade.

4. **Go service image**  
   - Built from `go-services/Dockerfile`: builder stage `golang:1.24-alpine`, runtime `alpine:3.20`. To use newer Go or Alpine, edit those `FROM` lines and rebuild.

5. **Frontend image (optional)**  
   - `frontend/Dockerfile` uses `node:24-alpine` and `nginx:alpine`. Bump those tags deliberately and rebuild after checking Node/nginx compatibility with the Vite build.

## Optional: build and run the frontend container

Not wired into `docker-compose.yml`; useful for testing a production build locally:

```bash
docker build -t skaftin-frontend:local \
  --build-arg VITE_API_URL=http://localhost:4006 \
  -f frontend/Dockerfile ./frontend

docker run --rm -p 3006:3006 skaftin-frontend:local
```

Adjust `VITE_API_URL` to wherever the browser will call the API (e.g. host gateway URL if the app runs in a browser on the host).

## Local app configuration (outside Docker)

When the **frontend** runs on the host and **API** runs in Docker:

- Point the frontend at `http://localhost:4006` (or use the Vite dev proxy as documented in `go-services/.env.example`).
- For Go running **outside** Docker but DB in Docker, use `DB_HOST=localhost` and `DB_PORT=5440` (host mapping for Postgres).

See `go-services/.env.example` for the full list of environment variables used by the gateway.

## Quick reference commands

```bash
docker compose logs -f go-service
docker compose restart go-service
docker compose exec postgres psql -U postgres -d skaftin_db -c '\dt'
```

---

*Compose path: `docker-compose.yml` (repository root). For a shorter checklist, see `docs/plans/DOCKER_LOCAL_SETUP.md`.*
