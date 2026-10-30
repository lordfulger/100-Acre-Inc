# 100 Acre Inc on your own server: builds the web game, then runs the game server
# (which serves the game and runs the multiplayer). See SELF-HOSTING.md.

# ---- build the web version of the game ----
FROM node:22-bookworm-slim AS build
WORKDIR /src
COPY app/package.json app/package-lock.json app/
RUN npm ci --prefix app
COPY app app
# Writes the finished web game to /src/server/public.
RUN npm run build:web --prefix app

# ---- run the game server ----
FROM node:22-bookworm-slim
WORKDIR /srv
COPY server/package.json server/package-lock.json server/
RUN npm ci --omit=dev --prefix server
COPY server/src server/src
COPY --from=build /src/server/public server/public
ENV NODE_ENV=production PORT=3001 DATA_DIR=/data
# Rooms are kept here too (as well as in Supabase), so mount it to keep them.
VOLUME /data
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s CMD node -e "fetch('http://localhost:3001/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"
CMD ["node", "server/src/index.js"]
