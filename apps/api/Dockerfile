# ---------- build stage ----------
FROM node:22-alpine AS builder

WORKDIR /app

# Copy root workspace files
COPY package.json package-lock.json turbo.json ./

# Copy only the packages/apps needed for the API build
COPY packages/shared/package.json ./packages/shared/package.json
COPY apps/api/package.json ./apps/api/package.json

# Install all dependencies (npm workspaces resolves internal refs)
RUN npm ci

# Copy source for shared package and API
COPY packages/shared/ ./packages/shared/
COPY apps/api/ ./apps/api/

# Build shared first (produces dist/ with .d.ts declarations), then API
RUN npm run build --workspace=packages/shared && \
    npm run build --workspace=apps/api

# ---------- production stage ----------
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Copy root workspace config
COPY package.json package-lock.json ./
COPY packages/shared/package.json ./packages/shared/package.json
COPY apps/api/package.json ./apps/api/package.json

# Install production deps only
RUN npm ci --omit=dev

# Copy built output
COPY --from=builder /app/apps/api/dist/ ./apps/api/dist/
COPY --from=builder /app/packages/shared/dist/ ./packages/shared/dist/

WORKDIR /app/apps/api

EXPOSE ${PORT:-3000}

CMD ["node", "dist/server.js"]
