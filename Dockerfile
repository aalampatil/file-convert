FROM node:25-bookworm-slim AS base
RUN apt-get update \
    && apt-get install -y --no-install-recommends libreoffice-writer fonts-dejavu-core fonts-liberation tini ca-certificates \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

FROM base AS build
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ENV REQUIRE_OFFICE=1
RUN npm run lint && npm run typecheck && npm test && npm run build

FROM base AS production
ENV NODE_ENV=production PORT=3000 DATA_DIR=/app/data XDG_CACHE_HOME=/tmp/folio-cache
COPY package.json package-lock.json ./
RUN npm ci --omit=dev \
    && npm cache clean --force \
    && mkdir -p /app/data \
    && chown node:node /app/data
COPY --from=build /app/.next ./.next
COPY --from=build /app/.worker ./.worker
COPY --from=build /app/public ./public
COPY --from=build /app/next.config.mjs ./next.config.mjs
COPY --from=build /app/scripts ./scripts
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/healthz').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["npm", "start"]
