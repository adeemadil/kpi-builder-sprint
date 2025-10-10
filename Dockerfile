##### KPI Builder - Multi-stage production build with Python+pandas for seeding

# ---- Stage 1: Builder ----
FROM node:18-alpine AS builder
WORKDIR /app

# Install build tools for native deps and Python for seeding
RUN apk add --no-cache make g++ python3 py3-pip py3-pandas

# Copy root package.json for workspace management
COPY package.json package-lock.json* ./

# Copy backend package files
COPY backend/package.json ./backend/

# Install root dependencies (concurrently for dev scripts)
RUN --mount=type=cache,target=/root/.npm npm install

# Install backend dependencies
WORKDIR /app/backend
RUN --mount=type=cache,target=/root/.npm npm install

# Copy backend source files and build
COPY backend/tsconfig.json ./
COPY backend/src ./src
RUN npm run build

# ---- Stage 2: Production Runner ----
FROM node:18-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Install Python3 and pandas for data seeding
RUN apk add --no-cache python3 py3-pandas \
    && rm -rf /var/cache/apk/*

# Copy root package.json for workspace scripts
COPY package.json ./

# Copy backend package files and install production dependencies only
COPY backend/package.json ./backend/
WORKDIR /app/backend
RUN --mount=type=cache,target=/root/.npm npm install --omit=dev

# Copy build output from builder stage
COPY --from=builder /app/backend/dist ./dist

# Copy data assets and seeding script
COPY backend/data ./data

# Install su-exec for user switching and create nodejs user
RUN apk add --no-cache su-exec && \
    addgroup -S nodejs && adduser -S nodejs -G nodejs && \
    mkdir -p /app/data && chown -R nodejs:nodejs /app

EXPOSE 3001

# Seed database and start server
CMD ["sh", "-c", "echo '🔌 Seeding database...' && cd /app/data && python3 /app/backend/data/seed_sqlite.py && echo '✅ Database seeded successfully' && echo '🚀 Starting backend server...' && cd /app/backend && exec su-exec nodejs npm start"]
