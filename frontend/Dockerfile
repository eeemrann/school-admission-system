# syntax=docker/dockerfile:1.7

FROM node:22-alpine AS build

WORKDIR /app

# Vite embeds this value at build time. The production default keeps browser
# requests same-origin so Nginx can proxy /api to the internal API service.
ARG VITE_API_BASE_URL=/api
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}

# Keep dependency installation in its own layer so source-only changes do not
# invalidate npm's lockfile-resolved dependency tree.
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

COPY frontend ./
RUN npm run build

FROM nginxinc/nginx-unprivileged:stable-alpine AS runtime

USER root

COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

# Nginx's unprivileged worker must be able to write its PID, cache, and proxy
# temporary files while still serving the immutable frontend as `nginx`.
RUN mkdir -p \
        /tmp/client_temp \
        /tmp/proxy_temp \
        /tmp/fastcgi_temp \
        /tmp/uwsgi_temp \
        /tmp/scgi_temp \
    && chown -R nginx:nginx \
        /etc/nginx \
        /tmp/client_temp \
        /tmp/proxy_temp \
        /tmp/fastcgi_temp \
        /tmp/uwsgi_temp \
        /tmp/scgi_temp \
        /usr/share/nginx/html

USER nginx

EXPOSE 8080

