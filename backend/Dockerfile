# ═══════════════════════════════════════════════════════════════════
# RIHLA Backend — Production Dockerfile (multi-stage, optimized)
# ═══════════════════════════════════════════════════════════════════

# ── Stage 1: Build dependencies ──────────────────────────────────
FROM python:3.12-slim AS builder

WORKDIR /build
COPY requirements.txt .

RUN pip install --no-cache-dir --prefix=/install -r requirements.txt

# ── Stage 2: Production runtime ──────────────────────────────────
FROM python:3.12-slim AS runtime

# Security: non-root user
RUN groupadd -r rihla && useradd -r -g rihla -d /app rihla

WORKDIR /app

# Copy only installed packages from builder (smaller image)
COPY --from=builder /install /usr/local

# Copy application code
COPY . .

# Remove dev files from final image
RUN rm -rf tests/ .pytest_cache/ __pycache__/ *.md .git/

# Set ownership
RUN chown -R rihla:rihla /app

USER rihla

# Expose the API port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')" || exit 1

# Production command: uvicorn with uvloop + httptools for maximum throughput
# Workers = 2 * CPU cores + 1 (set via WORKERS env var, default 4)
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers ${WORKERS:-4} --loop uvloop --http httptools --no-access-log"]
