# Plano — Autenticação, Usuários e Papéis

> **Status:** em andamento · **Iniciado em:** 2026-08-25
> **Regras de negócio:** [01 — Papéis e Permissões](../produto/01_papeis_e_permissoes.md) · [04 — Modelo de Dados §1](../produto/04_modelo_de_dados.md) · [03 — Navegação §3.3](../produto/03_navegacao_e_telas.md)

---

## 1. Objetivo

Entregar a fundação de identidade do sistema: **quem é o usuário, a que conta pertence, com quais papéis em quais empresas, e o que isso o autoriza a fazer**. É a primeira feature do backend — nada mais pode ser construído antes dela, porque toda entidade de negócio carrega `accountId` e toda rota depende de autorização.

Escopo desta feature:

- Modelagem de `Account`, `User`, `Membership` e `Company` (mínima, só o suficiente para o vínculo existir).
- Login, sessão (JWT), logout e recuperação de senha.
- Fluxo de convite com definição de senha — o caminho primário e **único** de entrada de usuário no sistema.
- Guardas de autorização no servidor: autenticação, papel e escopo de conta/empresa.
- Telas web correspondentes e substituição dos guards-stub do Angular.

**Fora do escopo** (features seguintes): desligamento com sucessão, tela de Equipe completa, notificações por e-mail além das de convite/senha, cadastro completo de empresa.

---

## 2. Estado atual (ponto de partida)

| Item | Situação |
| :--- | :--- |
| `apps/api/src` | Só o esqueleto Nest (`app.module`, `app.controller`, `app.service`, `main`). Nenhum módulo de negócio. |
| `apps/api/prisma/schema.prisma` | Apenas `datasource` (postgresql) + `generator`. **Zero models.** |
| Jest / Supertest no `apps/api` | **Não instalados e sem scripts** — `docs/backend/testes.md` descreve um setup que ainda não existe. |
| `packages/shared` | Só um `SharedHello` de exemplo. Nenhum contrato real. |
| `apps/web` guards | `authGuard` e `adminGuard` são stubs que fazem `return true` — **hoje toda rota protegida está aberta**. |
| `apps/web` tela de login | `auth.component.html` é literalmente `<h1>Login Page (/login)</h1>`. |
| Banco | Postgres no Neon, a ser criado. Connection string pendente. |

---

## 3. Decisões travadas

### Infraestrutura e credenciais

| # | Decisão | Definição |
| :-- | :--- | :--- |
| D1 | Banco | PostgreSQL no Neon, schema criado via `prisma migrate` (não há banco legado a reaproveitar). |
| D2 | Hash de senha | **Argon2id** para todas as senhas novas. O SHA-256 do legado não é adotado. |
| D3 | Senhas migradas | O hash legado (SHA-256 + salt de 32 bytes) é aceito **apenas** na primeira autenticação pós-migração, e imediatamente reescrito em Argon2id (*lazy rehash*). O campo legado é limpo no mesmo ato. |

### Sessão

| # | Decisão | Definição |
| :-- | :--- | :--- |
| D4 | Dois tokens | **Access token de ~15 min** (stateless, em toda requisição) + **refresh token de ~30 dias** (persistido no banco, usado só em `/auth/refresh`). O access token curto dispensa revogação; o refresh persistido torna a revogação imediata — exigência de "Revogação exige sucessão" ([01 §5](../produto/01_papeis_e_permissoes.md)) e da trilha de auditoria como prova ([05 §2](../produto/05_regras_transversais.md)). |
| D5 | Onde guarda (web) | Access token **na memória do JS** (nunca em `localStorage`); refresh token em **cookie `httpOnly`**, inacessível a XSS. No boot da aplicação, `/auth/refresh` restaura a sessão. |
| D6 | Onde guarda (mobile) | O app Capacitor **não usa cookie**: envia `Authorization: Bearer` e guarda o refresh token no *secure storage* do dispositivo. **A API nasce aceitando os dois modos.** |
| D7 | Rotação | Cada uso do refresh token emite um novo e invalida o anterior. Reaparecimento de um token já usado é tratado como roubo: revoga-se a família inteira e força-se novo login. Tokens são guardados **hasheados**. |
| D16 | E-mail ambíguo no login | `User.email` é único **por conta** (consequência de D11). O login busca os candidatos pelo e-mail e verifica a senha em cada um: bateu em um, entra direto; bateu em mais de um, a API responde `409 ACCOUNT_SELECTION_REQUIRED` com as consultorias, e a segunda chamada repete o mesmo endpoint com `accountId`. A lista só sai **depois** de a senha bater — devolvê-la antes tornaria o login um oráculo de quem é cliente de quem. |
| D8 | Conta ativa no token | O JWT carrega `accountId` **explícito** e a aplicação trata "conta ativa" como conceito desde já, mesmo existindo só uma — seguro barato para um eventual futuro de identidade multi-conta ([04 §1](../produto/04_modelo_de_dados.md)). |

### Papéis e escopo

| # | Decisão | Definição |
| :-- | :--- | :--- |
| D9 | Papéis | Os oito papéis de `Role` vivem no `Membership`, não no `User`. Permissão efetiva = união dos papéis do vínculo. |
| D10 | Isolamento | `accountId` em toda entidade, validado **no servidor**, nunca só na interface. |
| D11 | Identidade por conta | `User.accountId` é singular. Executor terceiro que atenda **duas consultorias** terá dois logins; dentro de uma mesma conta, um login basta. |
| D12 | Executor multi-empresa | `EXECUTOR` pode ter **vários `Membership` ativos** na mesma conta. A invariante de vínculo único vale só para papéis cujo escopo *é a empresa* (`MANAGER`, `CLIENT_ENGINEER`, `DIRECTOR`). |
| D13 | Executor tem conta | **Não existe magic link nem acesso anônimo.** Todo executor, inclusive terceiro, tem conta — a evidência é prova e exige autoria atribuível. O atrito é resolvido pelo fluxo: alguém da empresa cria o acesso e o executor só define a senha pelo link. |

### Escopo do MVP

| # | Decisão | Definição |
| :-- | :--- | :--- |
| D14 | Sem Trial | O conceito de conta Trial do legado (`IsTrialUser`, limite de dias/análises/membros) **não entra agora**. Se for necessário, entra depois por migration. Nenhum campo de trial no schema inicial. |
| D15 | Só convite | **Não há auto-cadastro.** A única entrada é o convite, e no MVP apenas para a consultoria. Auto-cadastro é caminho futuro provável (compra de plano) — não modelar agora, mas não criar nada que o impeça. |

---

## 4. Decisões pendentes

Nenhuma. As pendências que bloqueavam esta feature foram resolvidas e removidas de [`06_pendencias.md`](../produto/06_pendencias.md), com as regras escritas nos documentos de produto correspondentes.

> Se surgir uma decisão de negócio durante a implementação, ela **não se resolve no código**: escreva em `docs/produto` primeiro.

---

## 5. Passos

### Fase 0 — Fundação (sem regra de negócio ainda)

- [x] **0.1** Receber a connection string do Neon e criar `apps/api/.env` a partir do `.env.example`. *(Conectividade confirmada com `prisma db execute`. O `.env.example` cresceu: segredos de sessão, TTLs e `TEST_DATABASE_URL`.)*
- [x] **0.2** Instalar dependências do backend: `@nestjs/jwt`, `@nestjs/passport`, `passport-jwt`, `argon2`, `class-validator`, `class-transformer`, `@nestjs/config`, `cookie-parser`.
- [x] **0.3** Instalar e configurar o ferramental de teste que `docs/backend/testes.md` já pressupõe: `jest`, `ts-jest`, `@nestjs/testing`, `supertest`, mais os scripts `test`, `test:watch`, `test:cov`, `test:e2e` no `apps/api/package.json`.
- [x] **0.4** Criar `PrismaService` (módulo global) e `ConfigModule` com validação das variáveis de ambiente obrigatórias — falhar no boot se `DATABASE_URL` ou os segredos de JWT faltarem. *(Escrito e coberto por 9 testes de intenção. **Não compila até 1.6**: veja a nota abaixo.)*
- [x] **0.5** Definir a estratégia de banco de teste (branch dedicada no Neon) e o script de limpeza entre suítes — `test/setup-e2e.ts`, `test/reset-db.ts` e `scripts/migrate-test-db.js`, documentados em [testes.md](../backend/testes.md). Falta o usuário criar a branch e preencher `TEST_DATABASE_URL`.

> Nota de ordem, resolvida em 1.6: o `PrismaService` importa `PrismaClient`, que só existe após `prisma generate` — e o `generate` recusa rodar com `schema.prisma` sem models. A API ficou sem compilar entre 0.4 e 1.6.

### Fase 1 — Modelagem

- [x] **1.1** Escrever os enums no `schema.prisma`: `Role`, `UserStatus`, `AccountStatus`, `ExecutorType`, `RegistryType`, `PasswordAlgo`, `InvitationStatus`. *(`RoleSide` ficou fora do banco de propósito: é derivado do papel, e coluna + mapa poderiam divergir.)*
- [x] **1.2** Escrever os models `Account`, `User`, `Membership` e `Company` conforme [04 §1](../produto/04_modelo_de_dados.md), com os campos de auditoria (`createdAt`, `updatedAt`, `createdByUserId`) e de desativação (`disabledAt`, `succeededByUserId`). Sem campos de trial (D14).
- [x] **1.3** Adicionar os campos de credencial: `passwordHash`, `passwordAlgo` (`ARGON2ID` | `LEGACY_SHA256`), `legacyPasswordSalt`, `emailConfirmedAt`, `lastAccessAt`.
- [x] **1.4** Adicionar os models de fluxo: `Invitation` (token, expiração, papéis e escopo oferecidos, quem convidou), `PasswordResetToken` e `RefreshToken` (hash, expiração, família, revogação — D7).
- [x] **1.5** Traduzir as invariantes de [04 §1](../produto/04_modelo_de_dados.md) em constraints de banco. Duas ficaram **garantidas pelo Postgres**, não pela aplicação:
  - índice único parcial em `memberships(userId) WHERE isActive AND roles && ARRAY['MANAGER','CLIENT_ENGINEER','DIRECTOR']` — invariante 1, com `EXECUTOR` livre (D12);
  - chaves estrangeiras compostas `(userId, accountId)` e `(companyId, accountId)` — invariante 4, o vínculo não atravessa contas nem por bug de query.
  *(Invariante 2 — toda empresa ativa tem um Gestor — não cabe em constraint: é regra de transação, fica na Fase 3.)*
- [x] **1.6** Rodar a primeira migração e confirmar que o schema sobe limpo no Neon. *(Aplicada nas duas branches; invariantes verificadas contra o banco real.)*
- [x] **1.7** Publicar os contratos em `packages/shared/src/auth`: `Role`, `RoleSide`, `ROLE_SIDE`, `CAN_INVITE`, `User`, `Membership`, `Account` e os DTOs de rede. **Nenhuma interface de API pode ser declarada localmente no front.**

### Fase 2 — Testes de backend (vermelhos primeiro)

> [!IMPORTANT]
> TDD é obrigatório ([docs/README.md](../README.md)). Os testes descrevem **intenção de negócio**, não implementação: *"deve recusar login de usuário desligado"*, nunca *"deve chamar findUnique"*.

- [ ] **2.1** Testes do serviço de hash: gera Argon2id; valida senha correta; recusa senha errada; valida um hash legado SHA-256+salt conhecido; reescreve em Argon2id após validar o legado (D3).
- [ ] **2.2** Testes do `AuthService`: login com credenciais válidas; e-mail inexistente; senha errada; usuário `DISABLED`; usuário `INVITED` que ainda não definiu senha; e-mail não confirmado. **As mensagens de erro de e-mail inexistente e senha errada devem ser indistinguíveis** (não vazar existência de conta). Mais os três casos de D16: e-mail em uma conta só; e-mail em duas contas com senhas diferentes (entra direto, sem perguntar); e-mail em duas contas com a mesma senha (pede a consultoria, e a lista **não** sai se a senha estiver errada).
- [ ] **2.3** Testes de sessão (D4–D8): claims corretos (`userId`, `accountId` explícito); access token expira em 15 min; token adulterado é rejeitado; refresh emite novo par e invalida o anterior; **refresh token reusado revoga a família inteira**; revogar o usuário derruba a sessão no próximo refresh.
- [ ] **2.4** Testes do serviço de permissão — o coração da feature:
  - união de papéis num mesmo `Membership` (Gestor + Eng. do Cliente na empresa pequena);
  - escopo de consultoria abrangendo várias empresas × escopo de cliente restrito a uma;
  - **isolamento de conta**: usuário da conta A não alcança dado da conta B em nenhuma hipótese;
  - **isolamento entre empresas do lado cliente**: usuário da BRF não enxerga a Seara;
  - invariante de vínculo único para `MANAGER`/`CLIENT_ENGINEER`/`DIRECTOR`, e **`EXECUTOR` com vários vínculos vendo as tarefas de todas as suas empresas numa lista só** (D12);
  - executor não alcança análise, HRN nem tarefa de outro.
- [ ] **2.5** Testes do convite: escopo oferecido é subconjunto do escopo de quem convida; papel oferecido respeita a tabela "quem convida quem" ([01 §3](../produto/01_papeis_e_permissoes.md)); token expirado é recusado; token de uso único não serve duas vezes.
- [ ] **2.6** Testes e2e (Supertest) dos endpoints: `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`, `GET /auth/me`, `POST /auth/forgot-password`, `POST /auth/reset-password`, `POST /invitations`, `POST /invitations/:token/accept`. Cobrir os **dois modos de transporte** — cookie e bearer (D6).

### Fase 3 — Implementação do backend (até os testes passarem)

- [ ] **3.1** `PasswordService` — Argon2id, verificação do formato legado e lazy rehash (D2, D3).
- [ ] **3.2** `TokenService` — emissão, rotação, detecção de reúso e revogação em família (D4, D7).
- [ ] **3.3** `AuthModule`: login, refresh, logout, `me`. Aceitar cookie e bearer (D6). Registrar `lastAccessAt` no login bem-sucedido.
- [ ] **3.4** Guardas: `JwtAuthGuard` (autenticação), `RolesGuard` (papel) e `AccountScopeGuard` (conta + empresa). A autorização é **bidimensional** — papel × etapa ([01 §6](../produto/01_papeis_e_permissoes.md)); nesta feature entra a dimensão de papel, e a de etapa fica preparada para o plano de ação.
- [ ] **3.5** Fluxo de convite: criar convite, enviar e-mail com link, aceitar definindo senha, reenviar. Validar no servidor o teto de escopo e a tabela de quem convida quem (D15 — sem auto-cadastro).
- [ ] **3.6** Recuperação de senha: solicitar, validar token, redefinir — invalidando as sessões ativas.
- [ ] **3.7** Registrar em trilha de auditoria os eventos de identidade — login, falha de login, convite emitido/aceito, redefinição de senha, revogação ([05 §2](../produto/05_regras_transversais.md)).
- [ ] **3.8** Aplicar rate limiting nas rotas de login, refresh e recuperação de senha.
- [ ] **3.9** Seed de desenvolvimento: uma conta, um Engenheiro Responsável, uma empresa e um Gestor — o mínimo para o front trabalhar.

### Fase 4 — Testes de frontend

- [ ] **4.1** Testes do `AuthService` do Angular: mantém o access token **em memória**, expõe o usuário corrente, restaura a sessão no boot via `/auth/refresh` (D5).
- [ ] **4.2** Testes do interceptor HTTP: injeta o token nas chamadas; em `401`, tenta refresh uma única vez e desloga se falhar; requisições concorrentes durante o refresh não disparam múltiplos refreshes.
- [ ] **4.3** Testes dos guards reais: rota protegida redireciona anônimo para `/login`; rota de papel recusa papel insuficiente.
- [ ] **4.4** Testes da tela de login: erro de credencial exibido, botão desabilitado durante o envio, redirecionamento pós-login conforme o contexto do papel ([03 §1](../produto/03_navegacao_e_telas.md)).

### Fase 5 — Implementação do frontend

- [ ] **5.1** `AuthService` (token em memória) + interceptor com refresh silencioso.
- [ ] **5.2** Substituir os stubs `auth.guard.ts` e `admin.guard.ts` por verificação real, e criar um `roleGuard` parametrizável.
- [ ] **5.3** Tela de login (hoje um `<h1>`), seguindo o [Roteiro de Implementação](../web/roteiro_implementacao.md) — tokens semânticos, `rem`, dark mode, sem cor hardcoded.
- [ ] **5.4** Telas de aceitar convite / definir senha e de recuperar senha.
- [ ] **5.5** Roteamento por contexto: cada papel cai no contexto correto (0, 1, 2 ou Execução) após o login.
- [ ] **5.6** Exibir identidade e papel no shell da aplicação, com ação de logout.

### Fase 6 — Fechamento

- [ ] **6.1** Rodar a suíte completa (`test`, `test:e2e`, front) e confirmar verde.
- [ ] **6.2** Conferir que nenhuma permissão é aplicada só no front — toda regra tem contraparte validada no servidor.
- [ ] **6.3** **Extrair as decisões duráveis de arquitetura para `docs/backend/autenticacao.md`** — sessão, rotação de token, transporte duplo cookie/bearer, guardas. O sitemap já reserva o lugar ("*Em breve:* estrutura do backend"). Sem isso, D4–D8 se perdem quando este plano for apagado.
- [ ] **6.4** Atualizar `docs/produto` com toda regra que tenha sido decidida durante a implementação, e remover de `06_pendencias.md` o que foi resolvido.
- [ ] **6.5** Apagar este arquivo e remover a linha correspondente no [README dos planos](./README.md).

---

## 6. Riscos

- **Os guards-stub retornam `true`.** Enquanto a Fase 5 não fecha, qualquer rota "protegida" do front está aberta. Não publicar ambiente acessível antes disso.
- **Cookie cross-site nos ambientes de preview.** Com domínios próprios (`admin.normatiza.com` + `api.normatiza.com`) o cookie do refresh token é same-site e funciona limpo. Nas URLs de preview (`*.web.app` + URL do Cloud Run) é cross-site e exige `SameSite=None; Secure`. Resolver na Fase 3 para não descobrir no deploy.
- ~~**`docs/backend/testes.md` descreve um setup que não existe**~~ — resolvido em 0.3/0.5: o ferramental foi instalado e a doc, atualizada com a configuração real.
- **A migração do legado depende desta modelagem.** O mapeamento de `UserType` → `Role` (`Customer` → `DIRECTOR`, etc.) e a preservação de senhas via lazy rehash só funcionam se os campos legados existirem desde a primeira migração — daí o passo 1.3 vir antes de qualquer código de autenticação.
- **Sem Trial e sem auto-cadastro é decisão de MVP, não de arquitetura** (D14, D15). Não criar nada que impeça a entrada deles depois por migration.
