# Multi-stage Dockerfile for PulseQ
FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependency manifests
COPY package*.json ./

# Install all dependencies without running premature postinstall
RUN npm ci --ignore-scripts

# Copy full source code
COPY . .

# Build both client and server
RUN npm run build

# Production image
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Copy manifests and install only production runtime dependencies
COPY package*.json ./
RUN npm ci --only=production --ignore-scripts

# Copy compiled production assets from builder stage
COPY --from=builder /app/dist ./dist

EXPOSE 3000

CMD ["node", "dist/server/server/index.js"]
