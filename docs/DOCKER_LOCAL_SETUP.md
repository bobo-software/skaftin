# 🐳 Docker Local Development Setup

This guide explains how to set up and run all Docker containers required for local development of the Skaftin platform.

## 📋 Prerequisites

- **Docker** 20.10+ installed and running
- **Docker Compose** 2.0+ installed
- **Node.js** 22+ (for building images locally, if needed)

## 🏗️ Architecture Overview

The Skaftin platform consists of:

1. **Infrastructure Services** (via `docker-compose.yml`):
   - PostgreSQL 16 (Database)
   - MinIO (Object Storage)
   - SuperTokens (Authentication)

2. **Application Services** (optional Docker images):
   - Backend API (Node.js/TypeScript)
   - Frontend (React/Vite)

## 🚀 Quick Start

### Step 1: Start Infrastructure Services

Start all infrastructure services (PostgreSQL, MinIO, SuperTokens) using Docker Compose:

```bash
# From the project root directory
docker-compose up -d
```

This will start:
- **PostgreSQL** on port `5440` (mapped from container port 5432)
- **MinIO** on ports `9020` (API) and `9021` (Console)
- **SuperTokens** on port `3567`

### Step 2: Verify Services Are Running

Check that all containers are running:

```bash
docker-compose ps
```

You should see:
```
NAME                      STATUS
skaftin-postgres          Up
skaftin-minio             Up
skaftin-supertokens       Up
```

### Step 3: Access Services

- **PostgreSQL**: `localhost:5440`
  - User: `postgres`
  - Password: `BLUcabish#25`
  - Database: `skaftin_db`

- **MinIO Console**: http://localhost:9021
  - User: `minio_user`
  - Password: `laksdflaksdjflk`

- **SuperTokens**: http://localhost:3567
  - Health check: http://localhost:3567/hello

## 📦 Building Application Docker Images

### Backend Docker Image

Build the backend Docker image:

```bash
# From the project root directory
docker build -t skaftin-backend:latest -f Dockerfile .
```

**What this does:**
- Uses multi-stage build (Node.js 22 Alpine)
- Installs dependencies and builds TypeScript
- Creates production-ready image with only built files
- Exposes port `4006`

**Run the backend container:**

```bash
docker run -d \
  --name skaftin-backend \
  --network skaftin-network \
  -p 4006:4006 \
  --env-file .env \
  skaftin-backend:latest
```

### Frontend Docker Image

Build the frontend Docker image:

```bash
# From the project root directory
cd frontend
docker build -t skaftin-frontend:latest -f Dockerfile .
```

**What this does:**
- Builds React/Vite application
- Uses Nginx Alpine for serving static files
- Exposes port `3006` (or `3005` based on nginx config)

**Run the frontend container:**

```bash
docker run -d \
  --name skaftin-frontend \
  --network skaftin-network \
  -p 3005:3006 \
  -e VITE_API_URL=http://localhost:4006 \
  skaftin-frontend:latest
```

## 🔧 Complete Docker Compose Setup (Optional)

You can extend `docker-compose.yml` to include the application services:

```yaml
version: '3.8'

services:
  # ... existing services (postgres, minio, supertokens) ...

  # Backend API
  backend:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: skaftin-backend
    ports:
      - "4006:4006"
    env_file:
      - .env
    depends_on:
      - postgres
      - minio
      - supertokens
    networks:
      - skaftin-network
    restart: unless-stopped

  # Frontend
  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    container_name: skaftin-frontend
    ports:
      - "3005:3006"
    environment:
      - VITE_API_URL=http://localhost:4006
    depends_on:
      - backend
    networks:
      - skaftin-network
    restart: unless-stopped
```

Then run everything:

```bash
docker-compose up -d
```

## 🛠️ Development Workflow

### Recommended: Run Infrastructure in Docker, Apps Locally

For development, it's recommended to:

1. **Run infrastructure in Docker:**
   ```bash
   docker-compose up -d
   ```

2. **Run applications locally:**
   ```bash
   # Backend (from project root)
   npm run dev

   # Frontend (from frontend directory)
   cd frontend && npm run dev
   ```

This allows for:
- Hot reloading
- Easier debugging
- Faster iteration
- Direct access to logs

### Full Docker Development

If you prefer everything in Docker:

```bash
# Build all images
docker-compose build

# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop all services
docker-compose down
```

## 📊 Service Ports Reference

| Service | Container Port | Host Port | URL |
|---------|---------------|-----------|-----|
| PostgreSQL | 5432 | 5440 | `localhost:5440` |
| MinIO API | 9000 | 9020 | `http://localhost:9020` |
| MinIO Console | 9001 | 9021 | `http://localhost:9021` |
| SuperTokens | 3567 | 3567 | `http://localhost:3567` |
| Backend API | 4006 | 4006 | `http://localhost:4006` |
| Frontend | 3006 | 3005 | `http://localhost:3005` |

## 🔍 Useful Docker Commands

### View Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f postgres
docker-compose logs -f minio
docker-compose logs -f supertokens
```

### Stop Services

```bash
# Stop all services (keeps data)
docker-compose stop

# Stop and remove containers (keeps volumes)
docker-compose down

# Stop and remove everything including volumes (⚠️ deletes data)
docker-compose down -v
```

### Restart Services

```bash
# Restart all services
docker-compose restart

# Restart specific service
docker-compose restart postgres
```

### Access Container Shells

```bash
# PostgreSQL
docker exec -it skaftin-postgres psql -U postgres -d skaftin_db

# MinIO (if needed)
docker exec -it skaftin-minio sh

# Backend (if running)
docker exec -it skaftin-backend sh
```

## 🗄️ Database Initialization

When you start PostgreSQL for the first time, the database will be automatically initialized by the `DatabaseInitializer` when the backend starts.

**Manual database setup (if needed):**

```bash
# Connect to PostgreSQL
docker exec -it skaftin-postgres psql -U postgres -d skaftin_db

# The backend will automatically create all tables on startup
```

## 🧹 Cleanup

### Remove All Containers and Volumes

⚠️ **Warning**: This will delete all data!

```bash
# Stop and remove everything
docker-compose down -v

# Remove images (optional)
docker rmi skaftin-backend skaftin-frontend
```

### Reset Database Only

```bash
# Stop PostgreSQL
docker-compose stop postgres

# Remove PostgreSQL volume
docker volume rm skaftin_postgres-data

# Restart PostgreSQL (will create fresh database)
docker-compose up -d postgres
```

## 🐛 Troubleshooting

### Port Already in Use

If you get port conflicts:

```bash
# Check what's using the port
sudo lsof -i :5440  # PostgreSQL
sudo lsof -i :9020  # MinIO
sudo lsof -i :3567  # SuperTokens

# Stop conflicting services or change ports in docker-compose.yml
```

### Container Won't Start

```bash
# Check logs
docker-compose logs [service-name]

# Check container status
docker-compose ps

# Restart specific service
docker-compose restart [service-name]
```

### Database Connection Issues

```bash
# Verify PostgreSQL is running
docker-compose ps postgres

# Check PostgreSQL logs
docker-compose logs postgres

# Test connection
docker exec -it skaftin-postgres psql -U postgres -d skaftin_db -c "SELECT 1;"
```

### MinIO Access Issues

```bash
# Verify MinIO is running
docker-compose ps minio

# Check MinIO logs
docker-compose logs minio

# Access MinIO console: http://localhost:9021
# Default credentials: minio_user / laksdflaksdjflk
```

### SuperTokens Issues

```bash
# Verify SuperTokens is running
docker-compose ps supertokens

# Check SuperTokens logs
docker-compose logs supertokens

# Test health endpoint
curl http://localhost:3567/hello
```

### Network Issues

If containers can't communicate:

```bash
# Verify network exists
docker network ls | grep skaftin-network

# Recreate network
docker-compose down
docker-compose up -d
```

## 📝 Environment Variables

Make sure your `.env` file has the correct values for Docker:

```env
# Database (matches docker-compose.yml)
DB_HOST=localhost
DB_PORT=5440
DB_USER=postgres
DB_PASSWORD="BLUcabish#25"
DB_NAME=skaftin_db

# MinIO (matches docker-compose.yml)
MINIO_ROOT_USER=minio_user
MINIO_ROOT_PASSWORD=laksdflaksdjflk
MINIO_SERVER_URL=http://localhost:9020
MINIO_ENDPOINT=localhost:9020

# SuperTokens
SUPERTOKENS_CONNECTION_URI=http://localhost:3567
```

## 🎯 Next Steps

After setting up Docker:

1. ✅ Verify all services are running: `docker-compose ps`
2. ✅ Check service health endpoints
3. ✅ Start your backend application (locally or in Docker)
4. ✅ Start your frontend application (locally or in Docker)
5. ✅ Access the application at http://localhost:3005

## 📚 Additional Resources

- [Docker Documentation](https://docs.docker.com/)
- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [PostgreSQL Docker Image](https://hub.docker.com/_/postgres)
- [MinIO Documentation](https://min.io/docs/)
- [SuperTokens Documentation](https://supertokens.com/docs)

---

**Note**: For production deployments, use proper secrets management and don't hardcode passwords in `docker-compose.yml`.

