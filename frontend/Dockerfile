# Multi-stage Dockerfile for KPI Dashboard

# Stage 1: Data loader (Python)
FROM python:3.11-slim AS data-loader

WORKDIR /app

# Install PostgreSQL client
RUN apt-get update && apt-get install -y \
    postgresql-client \
    libpq-dev \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
RUN pip install --no-cache-dir psycopg2-binary

# Copy seed script and CSV data
COPY seed_postgres.py .
COPY public/work-package-raw-data.csv ./public/

# Stage 2: Build the React app
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Stage 3: Production server
FROM node:20-alpine AS runner

WORKDIR /app

# Install serve to host the static files
RUN npm install -g serve

# Copy built files from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./

# Copy seed script and CSV from data-loader stage
COPY --from=data-loader /app/seed_postgres.py ./
COPY --from=data-loader /app/public ./public

# Install Python and psycopg2 for optional data loading
RUN apk add --no-cache python3 py3-pip postgresql-client && \
    python3 -m pip install --break-system-packages psycopg2-binary

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000 || exit 1

# Start command
CMD ["serve", "-s", "dist", "-l", "3000"]
