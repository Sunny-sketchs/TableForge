# Stage 1: Build frontend
FROM node:20-slim AS frontend_builder
WORKDIR /app/frontend

# Copy package files
COPY frontend/package*.json ./

# Change ownership so npm install has write permissions
RUN chown -R node:node /app/frontend
USER node

# Install dependencies
RUN npm install
RUN npm audit fix --force

# 7/8: Copy files with correct ownership
COPY --chown=node:node frontend .

# 8/8: Guarantee permissions and execute build in one shell session
RUN chmod +x ./node_modules/.bin/* && npm run build

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

# Install Python dependencies
COPY backend/requirements.txt ./backend/
RUN pip install --upgrade pip && pip install -r backend/requirements.txt

# Copy backend code
COPY backend ./backend

# Copy built frontend from stage 1
COPY --from=frontend_builder /app/frontend/dist ./frontend/dist

EXPOSE 10000

# Healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:10000/api/health || exit 1

# Start backend server
CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "10000"]
