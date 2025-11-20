#!/bin/sh
# Setup script to create pg_cron symlinks on container startup
# This ensures pg_cron extension files are accessible to PostgreSQL

mkdir -p /usr/local/share/postgresql/extension
mkdir -p /usr/local/lib/postgresql

# Create symlinks for extension files
ln -sf /usr/share/postgresql17/extension/pg_cron* /usr/local/share/postgresql/extension/ 2>/dev/null || true

# Create symlink for library file
ln -sf /usr/lib/postgresql17/pg_cron.so /usr/local/lib/postgresql/pg_cron.so 2>/dev/null || true

echo "pg_cron symlinks created"

