FROM node:20-slim as frontend_builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
USER node
RUN npm install
RUN npm audit fix --force
COPY frontend .
RUN npm run build

FROM python:3.10-slim

RUN apt-get update && apt-get install -y --no-install-recommends

ghostscript

python3-tk

libsm6

libxext6

libxrender1

libgomp1

libglib2.0-0

&& rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY backend/requirements.txt ./backend/
RUN pip install --upgrade pip && pip install -r backend/requirements.txt

COPY backend ./backend

COPY --from=frontend_builder /app/frontend/dist ./frontend/dist

EXPOSE 10000

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3

CMD curl -f http://localhost:10000/api/health || exit 1

CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "10000"]