##### Backend Dockerfile - Multi-stage production build with Python+pandas for seeding

# ---- Stage 1: Builder ----
FROM node:18-alpine AS builder
WORKDIR /app

# Install build tools for native deps only in builder
RUN apk add --no-cache make g++ python3

COPY package.json package-lock.json* ./
# Cache npm modules
RUN --mount=type=cache,target=/root/.npm npm ci

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# ---- Stage 2: Production Runner ----
FROM node:18-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Install Python3 and pandas for data seeding (use Alpine packages to avoid PEP 668)
RUN apk add --no-cache python3 py3-pandas

# Copy only production dependencies
COPY package.json package-lock.json* ./
RUN --mount=type=cache,target=/root/.npm npm ci --omit=dev

# Copy build output
COPY --from=builder /app/dist ./dist

# Copy data assets for seeding
COPY data ./data

# Avoid running as root where possible
RUN addgroup -S nodejs && adduser -S nodejs -G nodejs
USER nodejs

EXPOSE 3001
CMD ["node", "dist/server.js"]
