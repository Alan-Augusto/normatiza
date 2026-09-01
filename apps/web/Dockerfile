# Imagem do painel web: build do Angular + nginx servindo o estático e fazendo a
# ponte para a API. O contexto de build é a RAIZ do monorepo.
#
#   docker build -f apps/web/Dockerfile .

# ── Compilação ───────────────────────────────────────────────────────────────
FROM node:22.22.3-bookworm-slim AS builder

RUN corepack enable && corepack prepare pnpm@11.9.0 --activate
WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc tsconfig.json ./
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/

RUN pnpm install --frozen-lockfile --filter web...

COPY packages/shared packages/shared
COPY apps/web apps/web

# A configuração `production` faz o fileReplacements de environment.ts por
# environment.production.ts — que aponta a API para a própria origem.
RUN pnpm --filter web build

# ── Execução ─────────────────────────────────────────────────────────────────
FROM nginxinc/nginx-unprivileged:1.29-alpine AS runner

COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/apps/web/dist/web/browser /usr/share/nginx/html

EXPOSE 8080
