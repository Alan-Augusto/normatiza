#!/usr/bin/env bash
#
# Coloca uma versão no ar. Roda NO SERVIDOR, na pasta que tem o compose.yml e o
# .env (por convenção /opt/normatiza).
#
#   ./deploy.sh              # sobe a tag que já está no .env
#   ./deploy.sh a1b2c3d      # sobe o SHA informado — é assim que se faz rollback
#
# Não precisa do código-fonte: as imagens vêm prontas do GHCR.

set -euo pipefail

cd "$(dirname "$0")"

if [[ ! -f .env ]]; then
  echo "erro: .env não encontrado em $(pwd)." >&2
  echo "      Copie o .env.example do repositório e preencha os segredos." >&2
  exit 1
fi

TAG_NOVA="${1:-}"

if [[ -n "$TAG_NOVA" ]]; then
  # Guarda a tag anterior antes de sobrescrever: se o deploy der errado, o
  # comando de volta está impresso na tela em vez de perdido no histórico.
  TAG_ANTERIOR="$(grep -E '^TAG=' .env | cut -d= -f2- || true)"
  echo "→ ${TAG_ANTERIOR:-?} ⇒ ${TAG_NOVA}"

  if grep -qE '^TAG=' .env; then
    sed -i "s|^TAG=.*|TAG=${TAG_NOVA}|" .env
  else
    echo "TAG=${TAG_NOVA}" >> .env
  fi
fi

echo "→ baixando imagens"
docker compose pull

# `up -d` recria o que mudou e deixa o resto de pé. O serviço `migrate` do
# compose roda antes da API subir; se a migração falhar, o compose aborta aqui
# e a versão anterior continua no ar, servida pelos containers que não foram
# derrubados.
echo "→ migrando e subindo"
docker compose up -d --remove-orphans

echo "→ estado"
docker compose ps

# Imagens antigas se acumulam rápido com deploy por SHA. Só as soltas, nunca as
# referenciadas pelo compose — dá para voltar para a versão anterior por um bom
# tempo.
docker image prune -f >/dev/null

echo
echo "no ar: $(grep -E '^TAG=' .env | cut -d= -f2-)"
if [[ -n "${TAG_ANTERIOR:-}" ]]; then
  echo "voltar: ./deploy.sh ${TAG_ANTERIOR}"
fi
