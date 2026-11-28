# syntax=docker/dockerfile:1
# Etapa 1: compilación reproducible con pnpm (versión fijada en package.json mediante corepack).
FROM node:22-alpine AS build
WORKDIR /app
ENV CI=true
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --ignore-scripts
COPY . .
# Mismo origen: Nginx hace proxy de /api/ hacia api-gateway:8080 (Etapa 2).
ARG VITE_API_BASE_URL=/api/v1
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}
RUN pnpm build

# Etapa 2: servidor estático sin herramientas de compilación.
FROM nginx:1.27-alpine
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 CMD wget -q -O /dev/null http://127.0.0.1/ || exit 1
