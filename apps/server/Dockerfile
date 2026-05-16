# Build context: monorepo root
# docker build -f apps/server/Dockerfile .
FROM node:18-alpine AS builder
WORKDIR /app

RUN corepack enable

# Copy workspace descriptors first for layer caching
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/server/package.json ./apps/server/

# Install server dependencies
RUN pnpm install --filter server --frozen-lockfile

# Copy source files needed by tsc (shared is referenced via relative path)
COPY apps/server ./apps/server
COPY apps/shared ./apps/shared

# Run build from workspace root so pnpm can resolve workspace binaries (tsc, etc.)
RUN pnpm --filter server build

FROM node:18-alpine AS runner
WORKDIR /app/apps/server

# Copy compiled output (rootDir=.. means output is under dist/server/server/src/)
COPY --from=builder /app/apps/server/dist/server ./dist/server
# pnpm hoists packages to root node_modules
COPY --from=builder /app/node_modules /app/node_modules
COPY --from=builder /app/apps/server/node_modules ./node_modules

# Runtime data files read relative to CWD (./src/database/...)
COPY --from=builder /app/apps/server/src/database/sqllite.sql ./src/database/sqllite.sql

# Navmesh files loaded by the server at runtime via process.cwd()/public/navmesh/
COPY apps/client/public/models/navmesh/ ./public/navmesh/

EXPOSE 3000
CMD ["node", "dist/server/server/src/index.js"]
