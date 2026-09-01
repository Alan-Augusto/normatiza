# Autenticação e Autorização

> **Regras de negócio:** [01 — Papéis e Permissões](../produto/01_papeis_e_permissoes.md) · [04 — Modelo de Dados §1](../produto/04_modelo_de_dados.md) · [05 — Regras Transversais §2](../produto/05_regras_transversais.md)

Este documento descreve **como** a identidade do sistema é implementada e **por que** cada escolha foi feita. O *o quê* — quem pode o quê — vive em `docs/produto`; aqui está a engenharia que sustenta aquilo.

---

## 1. O modelo em uma frase

**Uma pessoa tem um login por conta; o que ela pode fazer vem do vínculo, não do login.**

```
Account (a consultoria)
  └── User (a pessoa)          ← credencial vive aqui
        └── Membership         ← papéis vivem aqui, um por empresa
              └── Company
```

`User.passwordHash` responde "é você mesmo?". `Membership.roles` responde "e o que você pode fazer aqui?". Separar as duas é o que permite a mesma pessoa ser Gestor numa empresa e Executor noutra sem ter dois logins.

**A permissão efetiva de um vínculo é a união dos seus papéis.** Na empresa pequena, a mesma pessoa costuma ser Gestor *e* Engenheiro do Cliente — dois papéis num vínculo só, não dois vínculos.

---

## 2. Senhas

### Argon2id, com os parâmetros do OWASP

```ts
{ type: argon2id, memoryCost: 19_456, timeCost: 2, parallelism: 1 }
```

`memoryCost` é o que importa: 19 MiB por tentativa torna o ataque por GPU caro, porque GPU tem muitos núcleos e pouca memória por núcleo. Baixar esse número é baratear o ataque, não acelerar o login.

### O hash herdado do sistema antigo

O sistema legado guardava `SHA-256(salt de 32 bytes ‖ senha)`. SHA-256 é rápido — que é exatamente o defeito num hash de senha — e não pode ser convertido em Argon2id sem a senha em claro.

A saída é o **lazy rehash**: o hash legado é aceito **uma única vez**, no primeiro login pós-migração, e imediatamente reescrito em Argon2id no mesmo `UPDATE`, com `legacyPasswordSalt` zerado. Se o hash antigo continuasse aceito, a migração nunca terminaria.

> **A verificação do legado tenta `utf8` e depois `latin1`.**
> O código antigo usava `Encoding.Default.GetBytes(password)`, e `Encoding.Default` no .NET Framework depende da *code page* do sistema operacional onde a API rodava. Quem tem acento ou cedilha na senha pode ter o hash em qualquer uma das duas. Tentar só UTF-8 trancaria essas pessoas para fora por uma decisão de hospedagem que elas não tomaram.

### As recusas são indistinguíveis entre si

E-mail inexistente, senha errada, usuário `DISABLED` e convidado que ainda não definiu senha devolvem **a mesma mensagem e o mesmo status**:

```
401 — "E-mail ou senha inválidos."
```

Diferenciar essas respostas transformaria o login num oráculo: bastaria digitar e-mails para descobrir quem é cliente de quem.

---

## 3. Sessão: dois tokens

| | Access token | Refresh token |
| :--- | :--- | :--- |
| Vida | ~15 min | ~30 dias |
| Onde vive | memória do cliente | banco (`RefreshToken`) + cookie/secure storage |
| Estado | stateless (JWT) | persistido e **hasheado** |
| Usado em | toda requisição | só em `POST /auth/refresh` |

A combinação resolve uma tensão real: token stateless é rápido mas não se revoga; token de banco se revoga mas custa uma consulta por requisição. Com os dois, a revogação tem **efeito em no máximo 15 minutos** e o caminho quente não toca o banco.

Os 15 minutos não são cosméticos: [01 §5](../produto/01_papeis_e_permissoes.md) exige que revogar acesso funcione de verdade, e a trilha de auditoria só vale como prova se a sessão de quem foi desligado morrer.

### O que vai — e o que não vai — no token

```ts
interface AccessTokenClaims {
  sub: string;        // User.id
  accountId: string;  // explícito, nunca inferido
  iat: number;
  exp: number;
}
```

**Papéis não entram no token, de propósito.** Eles vivem no vínculo, mudam sem aviso e valem por empresa. Um token de 15 minutos carregando permissão seria permissão desatualizada por até 15 minutos — alguém rebaixado a Diretor continuaria escrevendo. A autorização é resolvida no servidor a cada requisição.

`accountId` viaja explícito e não é derivado do usuário: se um dia a identidade precisar atravessar contas, a autenticação não é reescrita.

### Rotação e detecção de reúso

Cada uso do refresh token emite um par novo e marca o anterior como usado. Os tokens são gravados **hasheados** (SHA-256) — vazamento do banco não entrega sessões.

Se um token **já usado** reaparece, só há duas explicações: ou o token foi roubado, ou o legítimo perdeu a resposta e repetiu. As duas se tratam igual — **revoga-se a família inteira** e força-se login novo.

> A família é a cadeia de rotações de **uma** sessão, não todas as sessões da pessoa. Roubo no navegador de casa não desconecta o celular do trabalho.

Isto tem uma consequência direta no cliente: **refreshes concorrentes precisam ser compartilhados**. Seis requisições que expiram juntas disparando seis refreshes fariam cinco chegarem com um token já rotacionado — e a detecção de reúso deslogaria o usuário justamente por ele ter tentado renovar do jeito certo. Ver §7.

---

## 4. Transporte duplo: cookie e cabeçalho

O painel web e o app de campo têm ameaças diferentes, e a API nasce atendendo os dois.

| | Web | App (Capacitor) |
| :--- | :--- | :--- |
| Access token | memória do JS | memória |
| Refresh token | cookie `httpOnly` | *secure storage* do aparelho |

**Quem escolhe o transporte é o cliente, não o servidor.** O app declara `X-Client: mobile`; sem esse cabeçalho, o refresh token sai **apenas** no cookie e nunca no corpo da resposta.

Nunca os dois ao mesmo tempo — isso seria o pior dos mundos: o token estaria no cookie protegido *e* numa string que o JavaScript da página consegue ler, anulando a proteção do `httpOnly`.

### O cookie

```
normatiza_rt=…; HttpOnly; Path=/auth; SameSite=Lax; Max-Age=2592000
```

- **`httpOnly`** — um XSS na página não lê a sessão longa.
- **`Path=/auth`** — o cookie só é enviado para a única rota que o usa. Requisição de dados não carrega credencial de longa duração à toa.
- **`SameSite`** depende da hospedagem: domínios irmãos (`admin.normatiza.com` + `api.normatiza.com`) compartilham o eTLD+1 e `Lax` basta; ambientes de preview (`*.web.app` + URL do Cloud Run) são *cross-site* e exigem `None`, que por sua vez exige `Secure`. É o que a variável `COOKIE_CROSS_SITE` controla.

> ⚠️ **`Path=/auth` decide o endereço da API.**
> O navegador só devolve o cookie em URLs sob esse caminho. Servir a API atrás de um proxy `/api` faria o cookie ser gravado e **nunca enviado** — a sessão morreria a cada recarregamento de página, sem erro nenhum na tela. Por isso a API responde na **raiz da própria origem**, em desenvolvimento e em produção, e o front aponta para ela via `API_BASE_URL` (`apps/web/src/environments/`).

---

## 5. O mesmo e-mail em duas consultorias

`User.email` é único **por conta**, não globalmente — consequência de a identidade pertencer à conta. Um executor terceiro que atenda duas consultorias tem dois logins com o mesmo e-mail.

O login resolve assim:

1. Busca **todos** os usuários com aquele e-mail, em qualquer conta.
2. Verifica a senha em cada um.
3. **Bateu em um** → entra direto. É o caso realista: senhas diferentes em cada consultoria.
4. **Bateu em mais de um** → `409` com as consultorias candidatas:
   ```json
   { "reason": "ACCOUNT_SELECTION_REQUIRED",
     "accounts": [{ "id": "…", "name": "Normatiza" }] }
   ```
   O cliente repete o **mesmo** endpoint acrescentando `accountId`.
5. **Não bateu em nenhum** → `401` genérico.

> **A lista só existe depois de a senha bater.** Devolvê-la antes tornaria o login um oráculo de quem é cliente de quem — e é por isso que também não se bloqueia e-mail duplicado no momento do convite: a recusa seria o mesmo vazamento, mais cedo.
>
> `accountId` não é credencial e não é confiado: a senha viaja junto e é verificada contra o usuário daquela conta. Um `accountId` arbitrário apenas falha a autenticação.

---

## 5.1. O Admin da Plataforma — o Contexto 0

O Admin do Sistema **não é um papel de vínculo**, e não está no enum `Role`.

O motivo é que `Role` responde sempre *"…nesta empresa, desta conta"*, e a plataforma não tem empresa nem conta. [01](../produto/01_papeis_e_permissoes.md) é explícito — *"não é uma pessoa dentro da operação do cliente: é a plataforma"*, escopo **Global**. Espremê-lo num `Membership` obrigaria a pendurá-lo numa empresa de uma consultoria cliente: o documento diria "global" e o banco diria "uma empresa de uma conta".

Ele vive numa tabela própria:

```prisma
model PlatformAdmin {
  userId          String    @unique   // qualquer usuário, de qualquer conta
  grantedByUserId String?
  grantedAt       DateTime  @default(now())
  revokedAt       DateTime?
}
```

**É tabela, e não um booleano em `User`**, por causa das três colunas de baixo. Um booleano responde *"é admin?"*; isto responde *"quem o tornou admin, quando, e quem revogou"* — a pergunta que aparece numa auditoria e que ninguém reconstrói depois. `revokedAt` preserva o fato de o acesso ter existido; um `UPDATE` para `false` o apagaria.

### Um login, não dois

`userId` aponta para **qualquer** usuário. Quem é dono da plataforma normalmente também é Engenheiro Responsável de uma consultoria, e obrigá-lo a um segundo e-mail seria atrito sem ganho: ele entra com o login de sempre e o backoffice aparece por cima, com o menu levando de um lado ao outro.

Uma conta dedicada à plataforma continua possível — é o caminho para um admin que não pertence a consultoria nenhuma. É a exceção, não a regra.

> **O acesso fica pendurado num usuário que vive dentro de uma consultoria.** Desativar aquele usuário derruba o Contexto 0 junto — de propósito: desligar alguém precisa fechar todas as portas de uma vez. O `pnpm admin:create` é o *break-glass* para quando isso acontece por engano.

### A porta é a CLI, não o convite

```bash
pnpm admin:create --email josue@email.com
pnpm admin:create --listar
```

O convite é a porta do **produto** — quem entra por ele entra numa consultoria, com papéis e empresas. Abrir um caminho no `CAN_INVITE` até `SYSTEM_ADMIN` daria ao teto de papel, hoje uma tabela fechada e auditável, uma aresta que leva ao topo. Depois do primeiro, os demais podem ser concedidos pela própria tela, com `grantedByUserId` preenchido.

O comando exige `--conta` quando o e-mail existe em mais de uma consultoria: escolher sozinho seria conceder acesso de plataforma à identidade errada, em silêncio.

### O isolamento não ganha exceção

Esta é a parte que sustenta o desenho. O caminho preguiçoso seria acrescentar *"…a não ser que seja admin"* ao `assertSameAccount` — e aí a exceção passaria a viver dentro do coração do isolamento, o lugar onde um bug vira vazamento entre clientes.

Não existe essa exceção. O admin da plataforma:

- **não vê dado de cliente** — o escopo dele é a conta dele, e o `if` do §6 o barra como a qualquer outro;
- opera sobre **contas como objetos** — controllers próprios do Contexto 0, com `PlatformAdminGuard`, que não passam pelo `PermissionService` de vínculo;
- para olhar **dentro** de um cliente, usa a impersonação auditada de [03 §2.1](../produto/03_navegacao_e_telas.md): emite-se uma sessão normal escopada naquela conta, e o `AuditLog` grava `actorUserId` = o admin de verdade.

A única porta para o dado do cliente é uma que deixa rastro com nome. Um superusuário que enxerga tudo o tempo todo não deixa rastro nenhum.

> **`PlatformAdminGuard` devolve `404`, não `403`** — mesmo motivo do isolamento de conta: para quem está de fora, o backoffice não é proibido, ele não existe.

### O que o admin não pode fazer

**Definir a senha de alguém.** Ele dispara a redefinição; a pessoa escolhe a própria senha. Se um admin pudesse escolher a senha de um Engenheiro Responsável, poderia entrar como ele e **emitir um laudo assinado com o CREA dele**. Laudo é documento técnico com responsabilidade legal, e o sistema não pode ter um caminho em que outra pessoa assina no lugar de um profissional.

**Revogar o próprio acesso.** Um sistema sem nenhum admin exige o banco para se recuperar. Barrar a auto-revogação não fecha todos os caminhos até lá, mas remove o mais fácil.

---

## 6. Autorização no servidor

A autorização do sistema é **bidimensional**: `PODE? = papel no vínculo × etapa do item` ([01 §6](../produto/01_papeis_e_permissoes.md)). Esta feature entrega a dimensão de papel; a de etapa entra com o plano de ação.

### As peças

| Peça | Responsabilidade |
| :--- | :--- |
| `JwtAuthGuard` | Autenticação: o token é válido e não expirou. |
| `RolesGuard` | Papel exigido pela rota (`@Roles(...)`), resolvendo a empresa a partir de `params.companyId ?? body.companyId`. |
| `PermissionService` | As perguntas de escopo: papéis efetivos, empresas ao alcance, se alcança **esta** empresa, se pode convidar **este** papel. |

Não existe `AccountScopeGuard` separado. O isolamento de conta é imposto por `PermissionService.assertSameAccount` e pelas chaves compostas do banco (§8) — uma guarda a mais que nenhuma rota usa não seria proteção, seria código não exercitado se dizendo proteção.

### Dado de outra conta não existe, não é proibido

`assertSameAccount` lança **`404`, não `403`**. Responder "proibido" confirmaria que o registro existe; para quem está de fora, ele simplesmente não existe.

### Vínculo inativo não conta

Todo cálculo de permissão filtra `isActive`. Desligar alguém de uma empresa é desativar o vínculo — e a permissão desaparece junto, sem depender de nenhuma limpeza posterior.

---

## 7. O lado do cliente (Angular)

O front decide **navegação**, não permissão. Quem burlar uma guarda com o devtools aberto continua esbarrando no servidor; o que se ganha é a pessoa certa não ver uma tela vazia sem explicação.

### Onde o token mora

Access token **em memória**, nunca em `localStorage` ou `sessionStorage` — o que está em storage é legível por qualquer script que entre na página. O que sobrevive ao recarregamento é o cookie de refresh, e é por isso que o boot chama `/auth/refresh` antes do primeiro roteamento (`provideAppInitializer`). Sem isso, o `authGuard` rodaria contra uma sessão ainda vazia e um F5 deslogaria quem tem cookie válido.

Falhar nessa chamada é o caminho **normal** de quem ainda não entrou — o erro é engolido de propósito, não vira tela de erro.

### O interceptor

- Anexa `Authorization: Bearer` e `withCredentials` **só** nas chamadas da API. Um CEP, um mapa ou um CDN não recebem a credencial da sessão por passarem pelo mesmo `HttpClient`.
- Em `401`, renova e repete a chamada. A repetição vai pela cadeia adiante, não volta ao interceptor — é o que garante **uma** tentativa por chamada, em vez de laço infinito quando o `401` persiste.
- **Não** renova em `403` (permissão insuficiente — nenhum token novo resolve) nem nas rotas de credencial (senha errada não é sessão expirada; refresh recusado é o fim da sessão).
- **Refresh compartilhado**: um só para todas as chamadas que caíram juntas — ver o alerta em §3.

### Porta de entrada por papel

`rotaDeEntrada()` traduz a tabela de [03 §1](../produto/03_navegacao_e_telas.md), do contexto mais alto para o mais baixo, e vive separada da tela de login porque a mesma decisão serve a quem entrou, a quem aceitou convite e a quem teve a sessão restaurada.

O lado cliente **nasce dentro do Contexto 2 e nunca sai dele**: mandar um Gestor ao dashboard da consultoria mostraria a ele que existe uma camada acima da empresa dele — e as outras empresas atendidas junto.

---

## 8. Duas invariantes que o Postgres garante

Regra de negócio que depende só de código de aplicação sobrevive até o primeiro `script` de correção rodado à mão. Estas duas estão no banco:

**Papel de escopo-empresa em um vínculo ativo só** — índice único parcial:

```sql
CREATE UNIQUE INDEX "memberships_company_scoped_role_unico"
  ON "memberships" ("userId")
  WHERE "isActive"
    AND "roles" && ARRAY['MANAGER','CLIENT_ENGINEER','DIRECTOR']::"Role"[];
```

É o que garante que a BRF nunca enxergue a Seara. `EXECUTOR` fica de fora de propósito: o escopo dele são as próprias tarefas, e atender várias empresas não lhe dá acesso em nível de empresa.

**Vínculo não atravessa contas** — chaves estrangeiras **compostas** `(userId, accountId)` e `(companyId, accountId)`, em vez das simples. Nenhum bug de query consegue ligar um usuário da conta A a uma empresa da conta B.

> A invariante "toda empresa ativa tem um Gestor" **não** cabe em constraint — é regra de transação, e vive na aplicação.

---

## 9. Trilha de auditoria

`AuditLog` registra os eventos de identidade: `auth.login`, `auth.login_failed`, `auth.logout`, `auth.token_reuse_detected`, `auth.password_reset_requested`, `auth.password_reset`, `auth.password_rehashed`, os de convite e os de plataforma (`platform_admin.granted`, `platform_admin.revoked`).

Duas decisões que valem lembrar:

**`actorUserId` é opcional.** O evento mais importante da trilha de autenticação é justamente o que **não tem autor**: tentativa de login com e-mail que não existe em conta nenhuma. Exigir autor obrigaria a inventar um ou a não registrar o evento — e é ele que denuncia um ataque em curso.

**Auditoria nunca derruba a operação que audita.** `AuditService.record` engole a falha para o log de erro: banco de auditoria indisponível não pode impedir alguém de entrar no sistema. Mas a falha **vai** para o log — auditoria que some em silêncio deixa de ser prova.

`AuditLog` é prova e não se apaga. Não confundir com `TimelineEvent`, que é narrativa de negócio.

---

## 10. Rate limiting

`@nestjs/throttler` nas rotas de credencial: **10 tentativas por minuto** em login e recuperação de senha, 60 em refresh.

O Argon2id encarece cada tentativa, mas não o volume — sem limite, um atacante testa milhares de senhas contra um e-mail que ele conhece.

A suíte de testes roda com o limite **desligado** (`THROTTLE_DISABLED`), porque dezenas de logins em segundos tropeçariam nele. Um spec dedicado o religa e prova que a décima primeira tentativa toma `429`. A alternativa — afrouxar os limites até os testes passarem — deixaria o limite existindo só na configuração.

---

## 11. Endpoints

| Rota | Guarda | Observação |
| :--- | :--- | :--- |
| `POST /auth/login` | — | Corpo: `email`, `password`, `accountId?` (§5). |
| `POST /auth/refresh` | — | Cookie ou `X-Refresh-Token`. Rotaciona. |
| `POST /auth/logout` | — | Revoga a família. |
| `GET /auth/me` | `JwtAuthGuard` | Usuário, conta e vínculos. |
| `POST /auth/forgot-password` | — | Resposta idêntica para e-mail existente e inexistente. |
| `POST /auth/reset-password` | — | Encerra **todas** as sessões ativas. |
| `POST /invitations` | `JwtAuthGuard` | Valida os dois tetos antes de qualquer escrita. |
| `POST /invitations/accept` | — | Token **no corpo** — ver abaixo. |
| `POST /invitations/:id/resend` | `JwtAuthGuard` | Rotaciona o token. |
| `GET /platform/admins` | `JwtAuthGuard` + `PlatformAdminGuard` | Contexto 0. `404` para quem não é admin. |
| `POST /platform/admins` | idem | Concede, registrando quem concedeu. |
| `DELETE /platform/admins/:userId` | idem | Revoga sem apagar a linha. |

> **Tokens de uso único vão no corpo, nunca no caminho da URL.**
> Caminho de URL acaba em log de servidor, histórico de navegador e cabeçalho `Referer`. Um token que define a senha de alguém não tem por que passar por lá. Vale para aceitar convite, redefinir senha e recuperar acesso.

---

## 12. Variáveis de ambiente

Validadas **no boot**, com falha ruidosa (`apps/api/src/config/env.validation.ts`). Configuração errada derruba a API na subida, em vez de virar comportamento estranho em produção.

| Variável | Regra |
| :--- | :--- |
| `DATABASE_URL` | Precisa ser Postgres. |
| `TEST_DATABASE_URL` | Obrigatória quando `NODE_ENV=test`, e **diferente** de `DATABASE_URL`. |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | Mínimo 32 caracteres e **diferentes entre si**. |
| `JWT_ACCESS_TTL` / `JWT_REFRESH_TTL` | `15m` / `30d`. |
| `COOKIE_CROSS_SITE` | `SameSite=None; Secure` quando front e API não compartilham o eTLD+1. |
| `THROTTLE_DISABLED` | Só para a suíte de testes. |

> A suíte e2e **trunca todas as tabelas** entre os casos. `TEST_DATABASE_URL` igual a `DATABASE_URL` apagaria o banco de trabalho — por isso a recusa está em código, em `test/setup-e2e.ts` e em `scripts/migrate-test-db.js`, e não só na documentação.

---

## 13. O que ainda não existe

- **Envio real de e-mail.** Convite e recuperação de senha geram o token e o registram; a entrega ainda não está ligada a um provedor.
- **Rotas de negócio.** A API tem hoje apenas `auth` e `invitations`. As telas do front guardadas por papel (Contexto 1, Contexto 0, Contexto 2) consomem *mocks* — **quando cada endpoint real nascer, ele precisa carregar a contraparte da guarda no servidor**, com `@Roles(...)` e verificação de escopo. A guarda do front não é a defesa.
- **Desligamento com sucessão** ([01 §5](../produto/01_papeis_e_permissoes.md)) — os campos existem no schema (`disabledAt`, `succeededByUserId`), o fluxo não.
- **Impersonação auditada** do Contexto 0 — é o caminho previsto para o admin ver dado de cliente (§5.1), e sem ela esse dado permanece fora do alcance dele.
- **As telas do Contexto 0** (contas, catálogos globais). Só `GET/POST/DELETE /platform/admins` existe hoje.
- **Trial e auto-cadastro** — decisão de MVP, não de arquitetura. Nada no schema impede que entrem por migration.

---

## 14. Índice de decisões (D1–D16)

O código cita estas siglas em comentários (`// … (D16)`). Elas nasceram no plano de implementação, que foi apagado quando a feature terminou — este índice é o que as mantém resolvíveis.

| # | Decisão | Onde está detalhada |
| :-- | :--- | :--- |
| D1 | PostgreSQL no Neon, schema criado por `prisma migrate`. Não há banco legado a reaproveitar. | §12 |
| D2 | Argon2id para toda senha nova. O SHA-256 do legado não é adotado. | §2 |
| D3 | Hash legado aceito **uma única vez** e reescrito em Argon2id no mesmo ato (*lazy rehash*). | §2 |
| D4 | Dois tokens: access de ~15 min (stateless) + refresh de ~30 dias (persistido). | §3 |
| D5 | Web: access token em memória, refresh em cookie `httpOnly`. Sessão restaurada no boot. | §3, §4, §7 |
| D6 | App de campo não usa cookie: `Authorization: Bearer` + *secure storage*. A API nasce aceitando os dois modos. | §4 |
| D7 | Rotação a cada uso; token reusado revoga a família inteira; tokens guardados hasheados. | §3 |
| D8 | O JWT carrega `accountId` **explícito**; "conta ativa" é conceito desde já. | §3 |
| D9 | Os papéis de vínculo vivem no `Membership`, não no `User`. Permissão efetiva = união dos papéis do vínculo. | §1 |
| D10 | `accountId` em toda entidade, validado **no servidor**, nunca só na interface. | §6, §8 |
| D11 | `User.accountId` é singular: quem atende duas consultorias tem dois logins. | §5 |
| D12 | `EXECUTOR` pode ter vários vínculos ativos; a invariante de vínculo único vale só para papéis de escopo-empresa. | §8 |
| D13 | Não existe magic link nem acesso anônimo — evidência é prova e exige autoria atribuível. | §11 |
| D14 | Sem Trial no MVP. Nenhum campo de trial no schema; entra depois por migration se preciso. | §13 |
| D15 | Sem auto-cadastro. A única entrada é o convite. | §11, §13 |
| D16 | E-mail único **por conta**: login resolve candidatos por senha e pede a consultoria só em caso de empate. | §5 |
| D17 | O Admin do Sistema sai do enum `Role` e vira dimensão própria (`PlatformAdmin`), sobreposta ao login normal. | §5.1 |
