# Deploy

> O plano anterior deste arquivo descrevia Cloud Run + Firebase + Neon. Era um
> plano, nunca foi implementado, e foi substituído pelo que está aqui — que é o
> que de fato roda.

O deploy é **Docker Compose**, e a escolha tem uma razão só: o servidor de hoje
é provisório. O sistema roda num homelab enquanto o produto amadurece e vai para
uma VPS de verdade quando for aprovado. Um deploy que amarra caminhos de home,
versão de Node instalada à mão e processos do PM2 transforma essa troca num
fim de semana de trabalho. Com containers, a troca é: instalar Docker, copiar
dois arquivos, restaurar o dump. As imagens são as mesmas, byte a byte.

## Como as peças se encaixam

```
Cloudflare (TLS)
      │
      ▼
cloudflared ──► 127.0.0.1:8007 ──► [web] nginx ─┬─► arquivos do Angular
                                                │
                                                └─► [api] Nest :3000
                                                          │
                                                          ▼
                                                    Neon (Postgres gerenciado)
```

Três serviços em `compose.yml` — `migrate`, `api` e `web` — mais o banco, que
vive fora, no Neon. Só o `web` publica porta, e mesmo assim apenas em
`127.0.0.1`: quem entra é o `cloudflared`, que roda no host. A API existe só na
rede interna do Docker, alcançável apenas pelos prefixos que o nginx encaminha
de propósito.

### Uma origem só, e por quê

`normatiza.alanaugusto.dev` serve **o painel e a API**. Não é preferência de
arquitetura, é consequência de uma decisão de autenticação: o cookie do refresh
token é gravado com `Path=/auth` (ver `docs/backend/autenticacao.md`). Um
navegador só devolve esse cookie em URLs sob esse caminho. Servir a API atrás de
um prefixo `/api` faria o cookie ser gravado e **nunca** ser enviado de volta —
a sessão morreria a cada recarregamento da página, sem erro nenhum na tela.

Daí saem três consequências, todas boas:

- **CORS deixa de existir.** Mesma origem não tem preflight. O
  `origin: true` de `apps/api/src/main.ts` — que refletiria qualquer origem —
  sai do caminho crítico, e a API sequer é alcançável de fora.
- **`COOKIE_CROSS_SITE=false`**, e o cookie fica `SameSite=Lax`.
- **A imagem do front não sabe em que domínio roda.** `apiBaseUrl` é string
  vazia, as chamadas saem relativas. Trocar de domínio não exige rebuild.

### O roteamento é por prefixo, e é frágil de propósito

`apps/web/nginx.conf` manda para a API tudo que começar com `auth`, `users`,
`companies`, `memberships`, `invitations` ou `platform`. O resto vai para o
`index.html` e quem resolve é o Angular Router.

> [!WARNING]
> **Prefixo novo na API precisa entrar no `nginx.conf` — e ser conferido contra
> `apps/web/src/app/app.routes.ts`.** Um `@Controller('admin')` sequestraria o
> painel administrativo inteiro; um `@Controller('login')`, a tela de login.
> Hoje não há colisão, e é uma verificação manual, não automática.

## O servidor de hoje

Homelab Ubuntu 26.04, x86_64, 4 núcleos, 5,2 GB de RAM. O banco é o **Neon**,
na mesma branch usada em desenvolvimento (ver o aviso em "Backup"). Três
particularidades que não se deduzem do `compose.yml`:

- **`HOST_PORT=8007`, não 8080.** O Cloudflare Tunnel é gerenciado por token
  (`cloudflared tunnel run --token-file`), então as rotas vivem no dashboard e
  não em disco. A rota de `normatiza.alanaugusto.dev` já apontava para a 8007,
  então foi mais simples levar o nginx até ela do que mexer no dashboard. As
  portas 8000–8006 são de outros projetos do mesmo servidor.
- **O placeholder foi desligado.** Havia um `normatiza.service` (systemd de
  usuário) servindo uma página estática de `/srv/clientes/normatiza/site` na
  8007. Está parado e desabilitado. Para trazê-lo de volta — e derrubar o app:

  ```sh
  cd /opt/normatiza && docker compose down
  systemctl --user enable --now normatiza.service
  ```

## Colocando de pé pela primeira vez

### 1. No servidor

Precisa apenas de Docker com o plugin `compose`. Nada de Node, nada de pnpm,
nada de PM2 — o servidor não compila nada, só baixa imagens prontas.

```sh
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker "$USER"   # saia e entre de novo para valer
```

### 2. A pasta do deploy

```sh
sudo mkdir -p /opt/normatiza && sudo chown "$USER" /opt/normatiza
cd /opt/normatiza
```

Copie para cá, do repositório, **dois arquivos**: `compose.yml` e
`scripts/deploy.sh` (que vira `/opt/normatiza/deploy.sh`). O código-fonte não
precisa existir no servidor.

### 3. O `.env`

Copie `.env.example` do repositório para `/opt/normatiza/.env` e preencha.

**Os segredos de sessão**, um para cada, diferentes entre si:

```sh
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

A API **recusa subir** se forem iguais ou tiverem menos de 32 caracteres. É
proposital: falha barulhenta no boot é melhor que um 500 silencioso na primeira
autenticação.

**As duas URLs do banco**, copiadas do painel do Neon. São o mesmo banco, e a
diferença é o sufixo `-pooler` no host:

| Variável | Endpoint | Quem usa |
| --- | --- | --- |
| `DATABASE_URL` | com `-pooler` | a aplicação |
| `DIRECT_URL` | sem `-pooler` | **só as migrações** |

A separação não é opcional: o endpoint com pooler é um pgbouncer em modo
*transaction*, e ele não sustenta os advisory locks que o `prisma migrate` usa
para serializar as migrações — por lá elas travam. É por isso que
`schema.prisma` declara `directUrl`.

### 4. Acesso ao registry

Se o pacote no GHCR estiver privado:

```sh
echo "SEU_TOKEN_COM_read:packages" | docker login ghcr.io -u SEU-USUARIO --password-stdin
```

Deixar os pacotes públicos no GitHub dispensa esse passo. As imagens não contêm
segredo nenhum (o `.dockerignore` barra os `.env`), então é uma escolha de
preferência, não de segurança.

### 5. Subir

```sh
cd /opt/normatiza && ./deploy.sh
```

### 6. Apontar o túnel

O `cloudflared` deve encaminhar `normatiza.alanaugusto.dev` para
`http://localhost:8080`.

### 7. O primeiro acesso

Como o banco do Neon já vem semeado, **o Josué já é admin da plataforma** —
`josue@email.com`, com a senha de `SEED_PASSWORD`. Não há nada a fazer aqui.

Num banco vazio, porém, não existe conta nenhuma e não há como enviar convite
sem alguém para enviá-lo. Aí a primeira entra por comando:

```sh
docker compose exec api pnpm --filter api admin:create \
  --email voce@exemplo.com --criar --nome "Seu Nome" --senha "uma senha forte"
```

Da segunda em diante o caminho é a tela `/admin/admins`.

> [!WARNING]
> **O comando não redefine senha.** Em `create-platform-admin.ts`, o
> `criarUsuário()` só é chamado quando o e-mail **não existe**
> (`filtrados[0] ?? (flag('criar') ? … : null)`). Para um usuário que já existe
> ele apenas concede o papel de admin, e o `--senha` é ignorado **em silêncio**
> — o comando ainda imprime "agora é admin da plataforma", como se tivesse
> funcionado.
>
> Consequência prática: **não existe hoje um caminho de recuperação** se todos
> os admins perderem o acesso. Nem o comando, nem a tela. Restam dois caminhos:
> o `/auth/forgot-password` (com `MAIL_TRANSPORT=console`, o link fica no log:
> `docker compose logs api | grep -i recupera`) e, neste ambiente, rodar o seed
> de novo — que redefine a senha de todo o elenco.

### 8. O runner do deploy automático

O deploy é disparado por um **runner self-hosted** rodando no próprio servidor.
A razão é o homelab: um runner faz apenas conexões de **saída** para o GitHub e
busca trabalho de lá, então não é preciso abrir porta de entrada nenhuma — nem
SSH exposto, nem Cloudflare Access com service token.

Em *Settings → Actions → Runners → New self-hosted runner* o GitHub gera um
token de registro (vale cerca de uma hora). No servidor:

```sh
mkdir -p /srv/actions-runner/normatiza && cd /srv/actions-runner/normatiza
VERSAO=$(curl -fsSL https://api.github.com/repos/actions/runner/releases/latest \
  | grep -oP '"tag_name": "v\K[^"]+')
curl -fsSL -o runner.tar.gz \
  "https://github.com/actions/runner/releases/download/v${VERSAO}/actions-runner-linux-x64-${VERSAO}.tar.gz"
tar xzf runner.tar.gz && rm runner.tar.gz

# O label `normatiza` é o que o workflow procura em `runs-on`.
./config.sh --unattended \
            --url https://github.com/Alan-Augusto/normatiza \
            --token SEU_TOKEN_DE_REGISTRO \
            --name normatiza-homelab --labels normatiza --work _work

# Como serviço, para sobreviver a reboot.
sudo ./svc.sh install "$USER"
sudo ./svc.sh start
```

O usuário do runner precisa estar no grupo `docker` (o serviço herda os grupos
no start, então um `usermod -aG docker` posterior exige reiniciar o runner) e
conseguir executar `/opt/normatiza/deploy.sh`.

O servidor atual já roda outros runners em `/srv/actions-runner/` — cada projeto
tem o seu, e é por isso que o `--labels` importa: é o label que faz o job cair
no runner certo.

> [!WARNING]
> **Um runner self-hosted executa código do repositório dentro da sua rede.**
> O job de deploy é protegido por `if: github.ref == 'refs/heads/main'`, então
> branches e pull requests não chegam nele. Se este repositório algum dia virar
> **público**, revise isso antes: um PR vindo de um fork rodando no seu homelab
> é o cenário que essa guarda existe para impedir.

## O ciclo do dia a dia

Push na `main` e pronto:

1. `build` compila as duas imagens nos runners do GitHub e publica no GHCR com
   duas tags — o SHA do commit e `latest`.
2. `deploy` roda no runner do servidor: `./deploy.sh <sha>`, que grava o SHA no
   `.env`, baixa as imagens, aplica as migrações e sobe. Depois cobra um `200`
   do site por até 60s; se não vier, o job falha e imprime os logs dos
   containers.

O servidor nunca compila nada e nunca precisa do código-fonte.

### Rollback

```sh
cd /opt/normatiza && ./deploy.sh <sha-anterior>
```

Mesmo comando, SHA antigo. Sem rebuild, sem esperar CI — a imagem já existe no
registry. O `deploy.sh` imprime a tag anterior ao trocar, justamente para que o
comando de volta esteja na tela em vez de perdido no histórico.

> [!NOTE]
> Rollback volta o **código**, não o **banco**. Se a versão nova trouxe uma
> migração destrutiva, voltar a imagem não desfaz o que a migração fez. É por
> isso que o backup abaixo importa.

### Por que a migração é um serviço separado

O `migrate` do compose é um container que roda e morre, e a API só sobe
**depois que ele termina com sucesso** (`service_completed_successfully`). Uma
migração que falha aborta o `up` inteiro e deixa a versão anterior no ar, em vez
de subir código novo contra um schema velho.

Ele usa `prisma migrate deploy`, nunca `migrate dev`: só aplica o que está
versionado em `apps/api/prisma/migrations`, jamais gera migração nova nem oferece
resetar o banco.

Chama o binário do Prisma direto, sem passar pelo pnpm, porque o pnpm é ativado
por corepack e o corepack baixa o pacote da internet no primeiro uso. Uma
migração que depende de `registry.npmjs.org` estar de pé é um deploy que falha
por motivo alheio ao código.

## Backup

O banco é o Neon, então o backup não é mais problema deste servidor — o Neon
mantém *point-in-time restore* e branches. Vale conferir a janela de retenção do
seu plano no painel, porque no plano gratuito ela é curta.

Um dump local, se quiser um segundo lugar:

```sh
docker compose run --rm --entrypoint sh api -c \
  'pg_dump "$DIRECT_URL"' | gzip > normatiza-$(date +%F).sql.gz
```

> [!CAUTION]
> **Homologação e desenvolvimento compartilham o MESMO banco do Neon.** O
> `DATABASE_URL` de `/opt/normatiza/.env` é a mesma string do `apps/api/.env`
> da máquina de desenvolvimento. Duas consequências que mordem:
>
> - `pnpm prisma:migrate` (que é `migrate dev`) na máquina local altera o banco
>   que o site publicado está usando — e pode oferecer resetá-lo.
> - `pnpm prisma:seed` redefine a senha de **todo o elenco** e sobrescreve nomes
>   e cargos, no ar.
>
> É aceitável enquanto isto é ambiente de homologação com dados de exemplo. Na
> ida para a VPS, a primeira coisa a fazer é separar: uma branch do Neon para
> produção, outra para desenvolvimento.
>
> A suíte e2e é a exceção segura: ela usa `TEST_DATABASE_URL`, que aponta para
> uma branch dedicada, e a API recusa subir com `NODE_ENV=test` se as duas forem
> iguais.

### O elenco de homologação

O banco é semeado com o elenco de `docs/produto/01_papeis_e_permissoes.md` —
Josué, Carla, Fernando, Marcos, Antonio, Débora, Rafael e Paulo. Todos entram
com `<primeiro-nome>@email.com` e a senha de `SEED_PASSWORD`.

Repetir o seed é seguro: ele casa por (conta, e-mail) e atualiza nome, cargo e
senha de quem já existe, sem duplicar. `SEED_RESET=1` apaga todo mundo antes, e
é opt-in explícito.

## Trazendo um Postgres local de volta

Se um dia o banco voltar para dentro do compose, é este serviço mais um
`depends_on` em `migrate` e `api`:

```yaml
  db:
    image: postgres:17-alpine
    restart: unless-stopped
    environment:
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB}
    volumes:
      - db-data:/var/lib/postgresql/data
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U $$POSTGRES_USER -d $$POSTGRES_DB']
      interval: 5s
      timeout: 5s
      retries: 12
      start_period: 20s

volumes:
  db-data:
```

Sem `ports:` — publicar a 5432 exporia o Postgres pelo túnel. Com banco local,
`DATABASE_URL` e `DIRECT_URL` passam a ser a mesma string (`@db:5432`), porque
não há pooler no caminho.

## Mudando de servidor

Que é o ponto de tudo isto:

1. Instale o Docker na máquina nova.
2. Copie `/opt/normatiza/` inteiro (`compose.yml`, `deploy.sh`, `.env`).
3. `./deploy.sh` — o banco é o Neon e já está lá; não há dado local a restaurar.
4. Registre o runner de novo (passo 8), com o mesmo label `normatiza`, e remova
   o antigo em *Settings → Actions → Runners*.
5. Aponte o DNS/túnel para a máquina nova.

Nada para recompilar, nenhuma versão de runtime para conferir, nenhum caminho
de home escrito em lugar nenhum.

O único ajuste possível é de arquitetura: as imagens são compiladas para
`linux/amd64`, que é o que os runners do GitHub produzem e o que o servidor
atual usa. Se a VPS nova for ARM, acrescente
`platforms: linux/amd64,linux/arm64` ao passo de build no workflow — o CI fica
mais lento e a imagem passa a servir aos dois.

## Quando a API ganhar host próprio

Se um dia a API sair para `api.exemplo.com`, três coisas mudam **juntas**, e
esquecer qualquer uma quebra o login sem mensagem de erro útil:

1. `apps/web/src/environments/environment.production.ts` volta a ter URL absoluta.
2. `COOKIE_CROSS_SITE=true` no `.env` — o cookie precisa de `SameSite=None; Secure`.
3. `apps/api/src/main.ts` precisa de uma allowlist de origens no lugar do
   `origin: true`, que hoje é inofensivo só porque a API não é alcançável de fora.
