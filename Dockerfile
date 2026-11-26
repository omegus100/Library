# One container: builds the client, then Express serves the site + API on one port.
# All data (SQLite database + cover images) lives in /data — mount a volume or NAS folder there.

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
# su-exec: drop from root to PUID/PGID after fixing /data ownership (see docker-entrypoint.sh)
RUN apk add --no-cache su-exec
WORKDIR /app/server
ENV NODE_ENV=production
COPY server/package.json server/package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund
COPY server/ ./
COPY --from=client /app/client/build /app/client-dist
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh && mkdir -p /data

ENV PORT=5000 \
    CLIENT_DIST=/app/client-dist \
    DATA_DIR=/data \
    COVER_STORAGE=local \
    PUID=1000 \
    PGID=1000

VOLUME /data
EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD wget -qO- http://127.0.0.1:5000/api/health || exit 1

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "index.js"]
