# One image: builds the client, then Express serves the site + API on one port.
#   docker compose up -d        (see docker-compose.yml and DOCKER.md)

# ---- 1. Build the client ----
FROM node:22-alpine AS client
WORKDIR /app/client
COPY client/package.json client/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY client/ ./
# --mode docker uses client/.env.docker: relative /api paths (same server)
RUN npx vite build --mode docker

# ---- 2. Server ----
FROM node:22-alpine
WORKDIR /app/server
ENV NODE_ENV=production
COPY server/package.json server/package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund
COPY server/ ./
COPY --from=client /app/client/build /app/client-dist

ENV PORT=5000 \
    CLIENT_DIST=/app/client-dist \
    COVER_STORAGE=local \
    COVER_DIR=/data/covers

RUN mkdir -p /data/covers && chown -R node:node /data /app/server
USER node
VOLUME /data/covers
EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD wget -qO- http://127.0.0.1:5000/api/health || exit 1

CMD ["node", "index.js"]
