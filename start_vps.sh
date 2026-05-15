#!/bin/bash
# ============================================================
#  Infinity Bot — VPS Start Script
#  Dùng để chạy trực tiếp trên VPS/server Linux
#  KHÔNG dành cho Workshop sandbox
# ============================================================
set -e

PORT=${PORT:-8000}
WORKERS=${WORKERS:-1}

echo "================================================"
echo "  Infinity Bot — VPS Deploy"
echo "  Port: $PORT | Workers: $WORKERS"
echo "================================================"

# ── 1. Kiểm tra Python & Node ─────────────────────────────
command -v python3 >/dev/null 2>&1 || { echo "❌ python3 chưa cài"; exit 1; }
command -v uv >/dev/null 2>&1      || { pip install uv -q; }
command -v bun >/dev/null 2>&1     || { echo "❌ bun chưa cài. Chạy: curl -fsSL https://bun.sh/install | bash"; exit 1; }

# ── 2. Cài Python deps ───────────────────────────────────
echo "[1/4] Cài Python dependencies..."
uv sync --frozen --compile-bytecode

# ── 3. Cài Node deps ─────────────────────────────────────
echo "[2/4] Cài Node dependencies..."
bun install --frozen-lockfile

# ── 4. Build React frontend → dist/ ──────────────────────
echo "[3/4] Build React frontend..."
bun run build

# ── 5. Khởi động FastAPI (serve cả frontend) ─────────────
echo "[4/4] Khởi động server tại port $PORT..."
echo ""
echo "✅ Dashboard: http://0.0.0.0:$PORT"
echo ""

exec uv run uvicorn app:asgi \
    --host 0.0.0.0 \
    --port "$PORT" \
    --workers "$WORKERS" \
    --access-log
