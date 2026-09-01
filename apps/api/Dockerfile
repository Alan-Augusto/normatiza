# Imagem da API. O contexto de build é a RAIZ do monorepo, não esta pasta —
# o pnpm workspace precisa enxergar pnpm-lock.yaml e packages/shared.
#
#   docker build -f apps/api/Dockerfile .

# ── Dependências e compilação ────────────────────────────────────────────────
# `bookworm-slim` e não `alpine`: o argon2 é módulo nativo e distribui prebuilds
# para glibc. No musl do Alpine ele compila do zero, o que exige toolchain e
# quebra de formas que só aparecem no build do servidor.
FROM node:22.22.3-bookworm-slim AS builder

# `openssl` é requisito do engine do Prisma; python3/make/g++ existem para o
# caso de algum nativo não ter prebuild para esta plataforma.
RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl ca-certificates python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

RUN corepack enable && corepack prepare pnpm@11.9.0 --activate
WORKDIR /app

# Manifests primeiro, código depois: enquanto as dependências não mudarem, o
# Docker reaproveita a camada do `pnpm install` inteira entre os deploys.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc tsconfig.json ./
COPY apps/api/package.json apps/api/
COPY packages/shared/package.json packages/shared/

# `api...` (com as reticências) traz a API e as dependências dela dentro do
# workspace — ou seja, o @normatiza/shared — e deixa web e mobile de fora.
RUN pnpm install --frozen-lockfile --filter api...

COPY packages/shared packages/shared
COPY apps/api apps/api

# `prisma generate` antes do build: o client gerado é importado pelo código que
# o webpack vai empacotar.
RUN pnpm --filter api prisma:generate \
    && pnpm --filter api build

# ── Execução ─────────────────────────────────────────────────────────────────
FROM node:22.22.3-bookworm-slim AS runner

RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

RUN corepack enable && corepack prepare pnpm@11.9.0 --activate
WORKDIR /app

# Copia a árvore inteira, com node_modules. É maior que um `--prod` enxuto, e é
# de propósito: o node_modules do pnpm é uma teia de symlinks para o store, e
# recortá-lo entre estágios é a origem clássica do "module not found" que só
# aparece em produção. Além disso o CLI do Prisma precisa continuar aqui — é
# ele que roda o `migrate deploy` do serviço `migrate` no compose.
COPY --from=builder /app /app

ENV NODE_ENV=production
EXPOSE 3000
USER node

# O builder do Nest é webpack (apps/api/nest-cli.json), então dist/main.js já é
# um bundle com o @normatiza/shared dentro.
CMD ["node", "apps/api/dist/main.js"]
