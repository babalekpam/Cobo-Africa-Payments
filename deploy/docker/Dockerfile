# syntax=docker/dockerfile:1
# One build, two runtime images:
#   target "api" — the API server (also runs the one-shot schema + first-run bootstrap job)
#   target "web" — nginx serving the React app and proxying /api to the API
# Build from the repository root:  docker compose build

FROM node:22-bookworm-slim AS build
ENV CI=true
RUN npm install -g pnpm@10.28.0
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @workspace/api-server run build
# The web app calls the API at the relative path /api, so it is built for the site root.
RUN NODE_ENV=production PORT=3000 BASE_PATH=/ pnpm --filter @workspace/cobo-payments run build

FROM build AS api
ENV NODE_ENV=production \
    PORT=8080 \
    OBJECT_STORAGE=local \
    LOCAL_STORAGE_DIR=/data/objects
RUN mkdir -p /data/objects && chown -R node:node /data
USER node
EXPOSE 8080
CMD ["node", "--enable-source-maps", "artifacts/api-server/dist/index.mjs"]

FROM nginx:1.27-alpine AS web
COPY deploy/docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/artifacts/cobo-payments/dist/public /usr/share/nginx/html
EXPOSE 80
