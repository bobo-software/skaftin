# Enable pg_cron Extension - Step by Step Guide

## Database Credentials
- **Host**: localhost
- **Port**: 5440
- **User**: postgres
- **Password**: BLUcabish#25
- **Database**: skaftin_db
- **Container**: skaftin-postgres-local (or skaftin-postgres)

---

## ✅ COMPLETE INSTALLATION (For Alpine PostgreSQL Images)

If `pg_cron` is not available, follow these steps:

### Step 1: Install pg_cron package
```bash
docker exec -it skaftin-postgres-local sh -c "apk add --no-cache postgresql-pg_cron"
```

### Step 2: Configure PostgreSQL
```bash
# Stop container
docker stop skaftin-postgres-local

# Update postgresql.conf to enable pg_cron
docker run --rm --volumes-from skaftin-postgres-local alpine sh -c "
  sed -i \"s/#shared_preload_libraries = ''/shared_preload_libraries = 'pg_cron'/\" /var/lib/postgresql/data/postgresql.conf
  echo \"cron.database_name = 'skaftin_db'\" >> /var/lib/postgresql/data/postgresql.conf
"
```

### Step 3: Create symlinks (required for Alpine)
```bash
docker start skaftin-postgres-local
sleep 5
docker exec -it skaftin-postgres-local sh -c "
  mkdir -p /usr/local/share/postgresql/extension /usr/local/lib/postgresql
  ln -sf /usr/share/postgresql17/extension/pg_cron* /usr/local/share/postgresql/extension/
  ln -sf /usr/lib/postgresql17/pg_cron.so /usr/local/lib/postgresql/pg_cron.so
"
```

### Step 4: Enable the extension
```bash
docker exec -it skaftin-postgres-local psql -U postgres -d skaftin_db -c "CREATE EXTENSION IF NOT EXISTS pg_cron;"
```

### Step 5: Verify
```bash
docker exec -it skaftin-postgres-local psql -U postgres -d skaftin_db -c "SELECT * FROM pg_extension WHERE extname = 'pg_cron';"
```

**Note**: The symlinks need to be recreated after each container restart. See "Making Symlinks Persistent" section below.

---

## Method 1: Using Docker Exec (If Already Installed)

Since your PostgreSQL is running in Docker, connect directly to the container:

### Step 1: Connect to PostgreSQL Container
```bash
docker exec -it skaftin-postgres-local psql -U postgres -d skaftin_db
```

### Step 2: Check if pg_cron is Available
```sql
SELECT * FROM pg_available_extensions WHERE name = 'pg_cron';
```

### Step 3: Enable pg_cron Extension
```sql
CREATE EXTENSION IF NOT EXISTS pg_cron;
```

### Step 4: Verify Installation
```sql
SELECT * FROM pg_extension WHERE extname = 'pg_cron';
```

### Step 5: Exit psql
```sql
\q
```

---

## Method 2: Using psql from Host Machine

If you have PostgreSQL client tools installed on your host machine:

### Step 1: Connect to Database
```bash
psql -h localhost -p 5440 -U postgres -d skaftin_db
```

When prompted, enter password: `BLUcabish#25`

### Step 2: Enable Extension
```sql
CREATE EXTENSION IF NOT EXISTS pg_cron;
```

### Step 3: Verify
```sql
SELECT * FROM pg_extension WHERE extname = 'pg_cron';
```

---

## Method 3: Using Environment Variables (One-liner)

```bash
PGPASSWORD="BLUcabish#25" psql -h localhost -p 5440 -U postgres -d skaftin_db -c "CREATE EXTENSION IF NOT EXISTS pg_cron;"
```

Or using Docker exec:
```bash
docker exec -it skaftin-postgres psql -U postgres -d skaftin_db -c "CREATE EXTENSION IF NOT EXISTS pg_cron;"
```

---

## Method 4: If pg_cron is Not Available in Current Image

If you get an error that pg_cron is not available, you need to use a PostgreSQL image that includes pg_cron, or install it manually.

### Option A: Use pg_cron-enabled Image

Update your `docker-compose.yml`:

```yaml
postgres:
  image: pgvector/pgvector:pg16  # Or use: postgres:16 with manual installation
  # OR use a custom image with pg_cron pre-installed
```

### Option B: Install pg_cron in Current Container

1. **Connect to container shell:**
```bash
docker exec -it skaftin-postgres sh
```

2. **Install pg_cron (Alpine Linux):**
```bash
apk add --no-cache postgresql16-contrib
# Or for other versions:
# apk add --no-cache postgresql-contrib
```

3. **Restart container:**
```bash
docker restart skaftin-postgres
```

4. **Then enable extension:**
```bash
docker exec -it skaftin-postgres psql -U postgres -d skaftin_db -c "CREATE EXTENSION IF NOT EXISTS pg_cron;"
```

---

## Method 5: Using SQL Script File

Create a file `enable_pg_cron.sql`:

```sql
-- Enable pg_cron extension
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Verify installation
SELECT * FROM pg_extension WHERE extname = 'pg_cron';
```

Then run:
```bash
docker exec -i skaftin-postgres psql -U postgres -d skaftin_db < enable_pg_cron.sql
```

---

## Verification

After enabling, verify it works:

```sql
-- Check extension is installed
SELECT * FROM pg_extension WHERE extname = 'pg_cron';

-- Check cron.job table exists
SELECT * FROM cron.job LIMIT 1;
```

If the second query returns (even if empty), pg_cron is working!

---

## Troubleshooting

### Error: "extension pg_cron is not available"

**Solution**: The PostgreSQL image doesn't include pg_cron. You need to:
1. Use a different PostgreSQL image that includes contrib extensions
2. Or manually install pg_cron in the container

### Error: "permission denied to create extension"

**Solution**: You need superuser privileges. The `postgres` user should have this, but if not:
```sql
-- Check if you're superuser
SELECT current_user, usesuper FROM pg_user WHERE usename = current_user;

-- If not superuser, connect as postgres user
```

### Error: "could not open extension control file"

**Solution**: pg_cron is not installed in the PostgreSQL instance. Follow Method 4 above.

---

## Quick Test

After enabling, test by creating a simple cron job:

```sql
SELECT cron.schedule('test-job', '*/1 * * * *', 'SELECT NOW();');
```

Then check if it was created:
```sql
SELECT * FROM cron.job WHERE jobname = 'test-job';
```

Delete the test job:
```sql
SELECT cron.unschedule('test-job');
```

---

## Making Symlinks Persistent

The symlinks created in Step 3 above are lost when the container restarts. To make them persistent, run this command after each container restart:

```bash
docker exec -it skaftin-postgres-local sh -c "
  mkdir -p /usr/local/share/postgresql/extension /usr/local/lib/postgresql
  ln -sf /usr/share/postgresql17/extension/pg_cron* /usr/local/share/postgresql/extension/
  ln -sf /usr/lib/postgresql17/pg_cron.so /usr/local/lib/postgresql/pg_cron.so
"
```

Or use the provided script:
```bash
docker exec -it skaftin-postgres-local sh /path/to/scripts/setup-pg-cron.sh
```

**Note**: For a permanent solution, consider updating your docker-compose.yml or creating a custom entrypoint script.

## Notes

- pg_cron extension is database-level, not schema-level
- Once enabled, it's available for all schemas in that database
- The extension creates a `cron` schema with tables like `cron.job` and `cron.job_run_details`
- Cron jobs run in the background and are managed by PostgreSQL's background worker process
- For Alpine-based PostgreSQL images, symlinks are required because PostgreSQL looks in `/usr/local/` but packages install to `/usr/share/postgresql17/`

