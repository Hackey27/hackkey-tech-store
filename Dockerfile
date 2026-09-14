# ---- Build stage: needs devDependencies (vite, esbuild, typescript) ----
FROM node:22-slim AS build
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

COPY . .
RUN npm run build

# ---- Runtime stage: production dependencies only ----
FROM node:22-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev && npm cache clean --force

# dist/ is the browser bundle served statically; dist-server/ is the API server.
COPY --from=build /app/dist ./dist
COPY --from=build /app/dist-server ./dist-server

# Run unprivileged; the node image ships a "node" user for exactly this.
USER node

# Documentation only -- Cloud Run injects PORT and the server reads it.
EXPOSE 8080

CMD ["node", "dist-server/server.cjs"]
