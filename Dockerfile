# Stage 1: Build frontend
FROM node:20-slim as frontend_builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
USER node
RUN npm install
RUN npm audit fix --force
COPY frontend .
RUN npm run build

# Stage 2: Backend with Python
FROM python:3.10-slim

# Install system dependencies for Camelot and cleanup
RUN apt-get update && apt-get install -y --no-install-recommends \
    ghostscript \
    python3-tk \
    libsm6 \
    libxext6 \
    libxrender1 \
    libgomp1 \
    libglib2.0-0 \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY backend/requirements.txt ./backend/
RUN pip install --upgrade pip && pip install -r backend/requirements.txt

COPY backend ./backend
COPY --from=frontend_builder /app/frontend/dist ./frontend/dist

EXPOSE 10000

# Healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:10000/api/health || exit 1

# Start backend server
CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "10000"]
