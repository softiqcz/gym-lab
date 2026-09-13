FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json vite.config.ts ./
COPY client ./client
COPY server/tsconfig.json ./server/tsconfig.json
COPY server/src ./server/src
RUN npm run build

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production PORT=3001 DATA_FILE=/app/data/workouts.json
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
COPY --from=build /app/server/dist ./server/dist
COPY server/data/workouts.json ./seed/workouts.json
COPY scripts/docker-entrypoint.sh ./scripts/docker-entrypoint.sh
RUN mkdir /app/data && chown node:node /app/data && chmod +x scripts/docker-entrypoint.sh
USER node
EXPOSE 3001
HEALTHCHECK --interval=10s --timeout=5s --start-period=10s --retries=3 CMD node -e "fetch('http://127.0.0.1:3001/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
ENTRYPOINT ["./scripts/docker-entrypoint.sh"]
CMD ["node", "server/dist/server.js"]
