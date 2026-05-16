# ── Stage 1: Build React frontend ──────────────────────────────────────────
FROM node:22-slim AS frontend

WORKDIR /app

# Install bun
RUN npm install -g bun

COPY package.json bun.lock bunfig.toml ./
RUN bun install --frozen-lockfile

COPY index.html tsconfig*.json postcss.config.js tailwind.config.js vite.config.ts components.json ./
COPY src/ ./src/

RUN bun run build

# ── Stage 2: Python runtime ─────────────────────────────────────────────────
FROM python:3.12-slim

WORKDIR /app

# Install uv
RUN pip install uv

# Copy Python deps
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev

# Copy app source
COPY app.py routes.py ./
COPY src/ ./src/
COPY static/ ./static/

# Copy built frontend from stage 1
COPY --from=frontend /app/dist ./dist

# Port Railway inject qua env PORT
ENV PORT=8000

CMD uv run uvicorn app:asgi --host 0.0.0.0 --port ${PORT}
