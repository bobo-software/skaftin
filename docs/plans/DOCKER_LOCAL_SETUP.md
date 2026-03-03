# Docker Local Development Setup

This guide covers the current local Docker setup for Skaftin after the Go cutover.

## Services

`docker-compose.yml` runs:
- PostgreSQL (`localhost:5440`)
- MinIO (`localhost:9020` + console `localhost:9021`)
- SuperTokens Core (`localhost:3567`)
- Go API gateway (`localhost:4006`)

There is no Node backend service in local compose anymore.

## Quick Start

```bash
docker compose up -d
docker compose ps
curl http://localhost:4006/api/v2/health
```

## Frontend + API

- Run frontend locally:
```bash
cd frontend && npm run dev
```
- Frontend default URL: `http://localhost:3005`
- API gateway URL: `http://localhost:4006`

## Build Images

Frontend:
```bash
docker build -t skaftin-frontend:latest -f frontend/Dockerfile ./frontend
```

Go service:
```bash
docker build -t skaftin-go-service:latest -f go-services/Dockerfile ./go-services
```

## Useful Commands

```bash
docker compose logs -f
docker compose logs -f go-service
docker compose restart go-service
docker compose down
docker compose down -v   # WARNING: deletes local data volumes
```

## Notes

- The Go gateway is the only backend runtime in local Docker.
- SuperTokens Core remains a required dependency for auth/session operations.
