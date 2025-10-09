##### KPI Builder - Multi-stage production build with Python+pandas for seeding

# ---- Stage 1: Builder ----
FROM node:18-alpine AS builder
WORKDIR /app

# Install build tools for native deps only in builder
RUN apk add --no-cache make g++ python3 py3-pip

# Copy backend package files
COPY backend/package.json backend/package-lock.json* ./backend/
WORKDIR /app/backend

# Cache npm modules
RUN --mount=type=cache,target=/root/.npm npm ci

# Copy backend source files
COPY backend/tsconfig.json ./
COPY backend/src ./src
RUN npm run build

# ---- Stage 2: Production Runner ----
FROM node:18-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Install Python3 and pandas for data seeding
RUN apk add --no-cache python3 py3-pip \
    && pip3 install pandas \
    && rm -rf /var/cache/apk/*

# Copy backend package files and install production dependencies
COPY backend/package.json backend/package-lock.json* ./backend/
WORKDIR /app/backend
RUN --mount=type=cache,target=/root/.npm npm ci --omit=dev

# Copy build output
COPY --from=builder /app/backend/dist ./dist

# Copy data assets and seeding script
COPY backend/data ./data

# Create startup script that handles seeding
RUN echo '#!/bin/sh' > /app/start.sh && \
    echo 'set -e' >> /app/start.sh && \
    echo 'echo "🔌 Checking database..."' >> /app/start.sh && \
    echo 'if [ ! -f "/app/data/kpi_builder.sqlite" ]; then' >> /app/start.sh && \
    echo '  echo "📊 Database not found. Seeding database..."' >> /app/start.sh && \
    echo '  cd /app/data' >> /app/start.sh && \
    echo '  python3 seed_sqlite.py' >> /app/start.sh && \
    echo '  cd /app' >> /app/start.sh && \
    echo '  echo "✅ Database seeded successfully"' >> /app/start.sh && \
    echo 'else' >> /app/start.sh && \
    echo '  echo "✅ Database found"' >> /app/start.sh && \
    echo 'fi' >> /app/start.sh && \
    echo 'echo "🚀 Starting Node.js server..."' >> /app/start.sh && \
    echo 'cd /app' >> /app/start.sh && \
    echo 'exec node backend/dist/server.js' >> /app/start.sh && \
    chmod +x /app/start.sh

# Avoid running as root where possible
RUN addgroup -S nodejs && adduser -S nodejs -G nodejs
USER nodejs

EXPOSE 3001
CMD ["/app/start.sh"]
