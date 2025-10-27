# Skaftin Deployment Guide

This guide covers deploying Skaftin using Docker Compose in different environments.

## Prerequisites

- Docker Engine 20.10+
- Docker Compose 2.0+
- 4GB+ RAM recommended
- 10GB+ disk space

## Quick Start (Development)

1. Clone the repository:
```bash
git clone <your-repo-url>
cd Skaftin
```

2. Create `.env` file:
```bash
cp .env.example .env
# Edit .env with your configuration
```

3. Start all services:
```bash
docker-compose up -d
```

4. Access the application:
- Frontend: http://localhost:3005
- Backend API: http://localhost:4005
- MinIO Console: http://localhost:9001
- SuperTokens: http://localhost:3567

## Production Deployment

### 1. Production Environment Setup

Create a production `.env` file:

```bash
# Production Environment
NODE_ENV=production

# Database
DB_PASSWORD=your-strong-password-here
DB_NAME=skaftin_prod

# SuperTokens
SUPERTOKENS_API_KEY=your-production-api-key

# OAuth
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret

# Email
EMAIL_USER=your-email@example.com
EMAIL_PASS=your-email-password

# MinIO
MINIO_ROOT_USER=your-minio-user
MINIO_ROOT_PASSWORD=your-minio-password

# Frontend URL (use your domain)
FRONTEND_URL=https://yourdomain.com
REACT_APP_API_URL=https://api.yourdomain.com
```

### 2. Start Production Services

```bash
# Build and start with production config
docker-compose -f docker-compose.yml -f docker-compose.production.yml up -d

# View logs
docker-compose logs -f

# Check service status
docker-compose ps
```

### 3. Database Migrations

Run database migrations:

```bash
# Access the backend container
docker exec -it skaftin-backend bash

# Run migrations (if you have a migration command)
npm run migrate
```

### 4. SSL/HTTPS Setup (Using Nginx)

Create `nginx.conf`:

```nginx
upstream frontend {
    server frontend:3005;
}

upstream backend {
    server backend:4005;
}

server {
    listen 80;
    server_name yourdomain.com;

    # Redirect to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    ssl_certificate /etc/nginx/ssl/yourdomain.crt;
    ssl_certificate_key /etc/nginx/ssl/yourdomain.key;

    # Frontend
    location / {
        proxy_pass http://frontend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # Backend API
    location /api {
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### 5. Backup and Recovery

#### Backup Database

```bash
# Backup PostgreSQL
docker exec skaftin-postgres pg_dump -U postgres skaftin_prod > backup.sql

# Backup MinIO data
docker run --rm -v skaftin_minio_data:/data -v $(pwd):/backup \
  alpine tar czf /backup/minio-backup.tar.gz /data
```

#### Restore Database

```bash
# Restore PostgreSQL
docker exec -i skaftin-postgres psql -U postgres skaftin_prod < backup.sql
```

### 6. Monitoring

Add monitoring with Prometheus and Grafana:

```yaml
# docker-compose.monitoring.yml
services:
  prometheus:
    image: prom/prometheus:latest
    ports:
      - "9090:9090"
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
  
  grafana:
    image: grafana/grafana:latest
    ports:
      - "3000:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
```

### 7. Scaling

Scale specific services:

```bash
# Scale backend instances
docker-compose up -d --scale backend=3
```

### 8. Health Checks

Check service health:

```bash
# Backend health
curl http://localhost:4005/api/health

# Database health
docker exec skaftin-postgres pg_isready

# MinIO health
curl http://localhost:9000/minio/health/live
```

## Common Commands

```bash
# Start services
docker-compose up -d

# Stop services
docker-compose down

# View logs
docker-compose logs -f [service-name]

# Restart a service
docker-compose restart [service-name]

# Remove all data (careful!)
docker-compose down -v

# Update and restart
git pull
docker-compose build --no-cache
docker-compose up -d
```

## Troubleshooting

### Port Conflicts

If ports are already in use:

```bash
# Check what's using the port
lsof -i :4005

# Change port in docker-compose.yml
ports:
  - "4006:4005"  # Map host port 4006 to container 4005
```

### Database Connection Issues

```bash
# Check database logs
docker-compose logs postgres

# Connect to database
docker exec -it skaftin-postgres psql -U postgres
```

### MinIO Setup Issues

```bash
# Check MinIO logs
docker-compose logs minio

# Access MinIO console
open http://localhost:9001
# Login with MINIO_ROOT_USER / MINIO_ROOT_PASSWORD
```

## Security Best Practices

1. **Use strong passwords** for all services
2. **Enable HTTPS** in production
3. **Regular backups** of database and files
4. **Keep images updated**: `docker-compose pull`
5. **Use secrets management** (Docker Swarm secrets or external tools)
6. **Limit network exposure** - only expose necessary ports
7. **Enable firewall** rules on the host machine

## Support

For issues or questions:
- Check logs: `docker-compose logs`
- Review health checks
- Ensure all environment variables are set
- Verify network connectivity between containers
