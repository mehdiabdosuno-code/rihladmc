#!/usr/bin/env bash
# init_db.sh — Initialize the STOURS Studio database
# Usage: ./scripts/init_db.sh

set -euo pipefail

echo "=== STOURS Studio — Database Initialization ==="

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "Error: Docker is not running. Please start Docker first."
    exit 1
fi

# Start PostgreSQL
echo "Starting PostgreSQL..."
docker compose -f docker/docker-compose.dev.yml up -d postgres

# Wait for PostgreSQL to be ready
echo "Waiting for PostgreSQL to be ready..."
until docker compose -f docker/docker-compose.dev.yml exec postgres pg_isready -U stours -d stours_studio > /dev/null 2>&1; do
    sleep 1
done

echo "PostgreSQL is ready."

# Run migrations
echo "Running Alembic migrations..."
cd backend && alembic upgrade head

echo "=== Database initialized successfully ==="
