# Plano — Gestão de Equipe

> **Status:** Fase 0 concluída · **Criado em:** 2026-08-26
> **Regras de negócio:** [01 — Papéis e Permissões](../produto/01_papeis_e_permissoes.md) · [03 — Navegação §3.3 e §4.5](../produto/03_navegacao_e_telas.md) · [04 — Modelo de Dados §1](../produto/04_modelo_de_dados.md)
> **Arquitetura existente:** [Autenticação e Autorização](../backend/autenticacao.md)

---

## 1. Objetivo

Fechar o ciclo de vida da pessoa dentro do sistema: **convidar, ver, mudar de papel e desligar** — com as telas onde cada um desses atos faz sentido para quem o pratica.

A feature de autenticação entregou a porta de entrada (o convite) e o motor de permissão. Falta tudo que vem depois de alguém entrar: nenhuma tela lista quem tem acesso, ninguém troca de papel sem `UPDATE` na mão, e não existe desligamento.

Escopo desta feature:

- Envio real de e-mail (convite e recuperação de senha) — sem isso o convite existe mas ninguém recebe.
- Listagem de equipe nos dois contextos.
- Convite pela interface, com os tetos já validados no servidor.
- Troca de papel e de escopo.
- Desligamento com sucessão.
- Perfil próprio editável.
- Tela de admins da plataforma (o endpoint já existe).

**Fora do escopo:** cadastro completo de empresa, fornecedores (`Supplier`), impersonação auditada, notificações que não sejam convite e senha.

---

## 2. Estado atual

| Item | Situação |
| :--- | :--- |
| `POST /invitations` | Existe, com os dois tetos validados e trilha de auditoria. |
| `POST /invitations/accept` · `/:id/resend` · `DELETE /:id` | Existem, com teste. |
| Listar usuários da conta | **Não existe** — nenhum endpoint. |
| Listar quem tem acesso a uma empresa | **Não existe.** |
| Trocar papel / escopo | **Não existe.** |
| Desligar usuário | **Não existe.** Os campos existem no schema (`disabledAt`, `succeededByUserId`); o fluxo, não. |
| Envio de e-mail | **Não existe.** O convite gera o token e ninguém o recebe. |
| Tela `/app/team` | **Não existe** a rota. |
| Tela `/app/companies/:id/team` | **Não existe** a rota. |
| `/app/profile` | Rota existe, componente é placeholder. |
| `GET/POST/DELETE /platform/admins` | Existem; **sem tela**. |
| `Supplier` (executor terceiro) | Não existe. `Membership.supplierId` é `String?` solto, sem relação. |

---

## 3. Decisões travadas

### Onde as telas vivem

| # | Decisão | Definição |
| :-- | :--- | :--- |
| D1 | Duas telas, não uma | **Equipe** ([03 §3.3](../produto/03_navegacao_e_telas.md)) no Contexto 1 e **Equipe da Empresa** ([03 §4.5](../produto/03_navegacao_e_telas.md)) no Contexto 2. Não é a mesma tela com filtro: o lado cliente **nunca pode ver que existe uma camada acima da empresa dele** — o Marcos numa tela "da conta" descobriria que a Normatiza atende a Seara. |
| D2 | O Contexto 0 não gerencia usuário de cliente | O backoffice administra **contas** e **admins da plataforma**. Para mexer no usuário de um cliente, o caminho é a impersonação auditada. Um painel onde o admin edita usuário de cliente direto seria poder sem rastro. |

### Ciclo de vida

| # | Decisão | Definição |
| :-- | :--- | :--- |
| D3 | Quem convida, concede e remove | A alçada para **trocar** o papel de alguém é a mesma de convidá-lo: reusa `CAN_INVITE`. Sem regra nova, sem segunda tabela a manter em dia. |
| D4 | Sucessor só quando a saída quebra uma invariante | Tirar o último Gestor da BRF **exige** sucessor; tirar um Executor entre cinco, não. Pedir sempre viraria burocracia em 90% dos casos, e burocracia inútil é o que faz gente contornar o fluxo. |
| D5 | Desliga-se quem não se convidou | Dentro do próprio escopo e da própria alçada. Sem isto, um Executor convidado por alguém que já saiu ficaria ativo e órfão, sem ninguém com poder de encerrá-lo. |
| D6 | **Não existe *delete*** | Desligar é `disabledAt` + sucessão. Apagar a pessoa apagaria a autoria das evidências que ela entregou — e evidência é prova. |
| D7 | E-mail é imutável | Nome e telefone o próprio dono edita; papel e escopo, quem tem alçada. **Ninguém edita o e-mail de outra pessoa**: mudar o e-mail alheio é, na prática, assumir a conta dela — o link de redefinição passa a chegar na caixa nova. Troca de e-mail, se um dia existir, é fluxo com confirmação nos dois endereços. |

### Sair da empresa ≠ sair da conta

| # | Decisão | Definição |
| :-- | :--- | :--- |
| D8 | São duas ações diferentes, em duas telas diferentes | **Remover da empresa** desativa *aquele* vínculo (`Membership.isActive = false`) e vive na Equipe da Empresa. **Desligar da conta** marca `User.disabledAt`, encerra as sessões e derruba todos os vínculos — e vive na Equipe da consultoria. A Carla sair da carteira da BRF não é a Carla sair da Normatiza. |

### Executor terceiro e titular da conta

| # | Decisão | Definição |
| :-- | :--- | :--- |
| D11 | Executor terceiro sem fornecedor | O convite de Executor pergunta apenas **interno × terceiro**; **não** pergunta de qual empresa prestadora. `Membership.supplierId` continua existindo e sem uso. Fornecedor pertence à feature de custos — é ele que alimenta a Tabela de Preços ([03 §4.6](../produto/03_navegacao_e_telas.md)) —, e fazer meio cadastro aqui significaria refazê-lo lá. |
| D12 | O titular da conta não é desligável | **Por ninguém** — nem por outro Engenheiro Responsável, nem pelo Admin do Sistema. Não é alçada insuficiente: desligar o titular deixaria a consultoria sem dono, e sem dono não há quem convide, administre ou responda por ela. Trocar o titular é **transferência de titularidade**, caso particular com fluxo próprio, fora desta feature. Regra escrita em [01 §5](../produto/01_papeis_e_permissoes.md). |

### Infraestrutura

| # | Decisão | Definição |
| :-- | :--- | :--- |
| D9 | E-mail pelo **Resend** | Domínio próprio, integração curta, plano grátis cobre desenvolvimento. Token em `RESEND_API_KEY`, validado no boot como os demais segredos. |
| D10 | Falha de e-mail não derruba a operação | Mesmo princípio da auditoria: o convite é criado, o e-mail vai para fila/log se falhar, e a tela oferece **reenviar**. Um provedor fora do ar não pode impedir o onboarding. |

---

## 4. Decisões pendentes

Nenhuma. As duas que bloqueavam a Fase 1 foram resolvidas em D11 e D12, e a regra de negócio de D12 está escrita em [01 §5](../produto/01_papeis_e_permissoes.md).

> Se surgir uma decisão de negócio durante a implementação, ela **não se resolve no código**: escreva em `docs/produto` primeiro.

---

## 5. As telas

> Todas seguem o [Roteiro de Implementação](../web/roteiro_implementacao.md): sem cabeçalho local, `label` e `subtitle` na rota, tokens semânticos, `rem`, dark mode.

### 5.1. Equipe — Contexto 1

**Rota:** `/app/team` · **Guarda:** `roleGuard(CONTEXTO_1)` · **Quem usa:** Josué, Carla, Fernando

Gestão dos usuários **da conta**.

**Tabela:** Nome · Papel(is) · Escopo (empresas) · Quem convidou · Último acesso · Status
**Filtros:** por papel, por empresa, por status (ativo · convite pendente · desligado)

**Ações por linha, conforme a alçada de quem olha:**
- Reenviar convite / revogar convite — só em `PENDING`
- Trocar papel · Editar escopo (quais empresas)
- Desligar da conta

**Estados que a tela precisa mostrar sem inventar:**
- Convite pendente, com quantos dias faltam para expirar (são 7)
- Convite expirado — reenviar é a saída
- Desligado, com quem sucedeu

> A lista de papéis oferecida **não é a lista completa**: é o que `CAN_INVITE` permite a quem está olhando. A Carla vê "Técnico" e mais nada. Mostrar papéis que o servidor vai recusar é convidar ao erro.

### 5.2. Equipe da Empresa — Contexto 2

**Rota:** `/app/companies/:companyId/team` · **Guarda:** `roleGuard(VÊ_A_EMPRESA)` · **Quem usa:** Marcos, Antonio — e a consultoria quando está dentro da empresa

Quem tem acesso **a esta empresa**: consultoria alocada, gente do próprio cliente e terceiros.

**Tabela:** Nome · Papel · Origem (consultoria · cliente · terceiro) · Último acesso · Status
**Convite:** o escopo **já vem preenchido** com esta empresa — não há seletor de empresas.

**Ações:** convidar (Marcos → Eng. do Cliente, Diretor, Executor; Antonio → Executor) · trocar papel · **remover da empresa**.

> **Aqui não existe "desligar da conta".** O Marcos pode tirar alguém da BRF; ele não tem alçada para apagar essa pessoa da Normatiza. A separação é o D8, e ela precisa estar visível na linguagem do botão — "Remover da empresa", nunca "Excluir".
>
> **A consultoria aparece na lista, mas o cliente não a gerencia.** O Marcos vê que a Carla atende a BRF; ele não a remove.

### 5.3. Meu Perfil

**Rota:** `/app/profile` (já existe, hoje placeholder) · **Quem usa:** todos

Dados próprios: nome, telefone, cargo, registro profissional (CREA/CFT) quando o papel comporta. **E-mail em leitura**, com nota do porquê. Trocar a própria senha. Ver os próprios vínculos e papéis — é onde a pessoa entende o que ela é no sistema.

### 5.4. Admins da Plataforma — Contexto 0

**Rota:** `/admin/admins` · **Guarda:** `adminGuard` · **Quem usa:** admin da plataforma

O endpoint já existe. Tabela: Nome · E-mail · Conta de origem · Quem concedeu · Concedido em · Status. Conceder por e-mail; revogar. O botão de revogar a si mesmo não existe — o servidor já recusa, e oferecer o que será recusado é ruído.

### 5.5. Os fluxos que atravessam telas

**Convidar** — mesmo formulário nas duas telas, com o escopo pré-preenchido no Contexto 2. Campos conforme [03 §3.3](../produto/03_navegacao_e_telas.md): dados, papel, tipo de executor, perfil profissional, escopo.

**Trocar papel** — precisa antecipar a invariante do banco: papel de escopo-empresa (`MANAGER`, `CLIENT_ENGINEER`, `DIRECTOR`) só vale em **um** vínculo ativo. Dar `MANAGER` a quem já é Gestor de outra empresa é recusado pelo índice parcial. A tela explica isso **antes** do envio; um erro de constraint vazando para a interface é falha de desenho.

**Desligar** — o passo de sucessão só aparece quando a saída quebra algo (D4):
- último Gestor de uma empresa ativa → **exige** sucessor;
- **titular da conta → a ação não existe** (D12). Não é botão desabilitado com aviso: é ação que a tela não oferece, porque não há caminho para ela;
- demais casos → confirmação simples.

O que o sucessor herda e o que acontece com o que estava no nome de quem saiu precisa estar escrito na tela, não implícito.

---

## 6. Passos

### Fase 0 — E-mail

- [x] **0.1** Instalar o SDK do Resend; `RESEND_API_KEY` e `MAIL_FROM` no `.env.example` e na validação de boot.
- [x] **0.2** `MailService` com dois templates: **convite** e **recuperação de senha**. Falha vai para o log e não derruba a operação (D10).
- [x] **0.3** Modo de desenvolvimento: sem chave, o e-mail é impresso no console com o link — para trabalhar sem consumir cota e sem depender de rede.
- [x] **0.4** Ligar aos fluxos que já existem (`POST /invitations`, `POST /auth/forgot-password`) e conferir a ponta a ponta com um endereço real.

> **Estado: verde.** 12 testes cobrem a **trava de envio** — que é o ponto sensível deste serviço, não a entrega.
>
> **O envio real é opt-in explícito.** `MAIL_TRANSPORT=console` é o padrão e imprime o link no log sem enviar nada. Três travas por cima: `NODE_ENV=test` nunca envia; `MAIL_TRANSPORT=resend` fora de produção **exige** `MAIL_ALLOWLIST`, validado no boot; e sem lista, fora de produção, o padrão é não enviar para ninguém — nunca "enviar para todos". O motivo é o elenco de testes e o seed usarem domínios inexistentes (`marcos@brf.com`, `josue@normatiza.com`): *hard bounce* queima a reputação do remetente, e reputação queimada faz o convite legítimo do cliente cair em spam.
>
> **Verificado contra o Resend de verdade:** convite entregue a um endereço real; a mesma rota, chamada com endereço do elenco, foi barrada pela allowlist. A suíte e2e completa (81 testes) rodou com a chave presente e não enviou nada.

### Fase 1 — Contratos e modelagem

- [ ] **1.1** Confirmar que D11 e D12 não exigem migration — a expectativa é que não: `supplierId` já existe e fica sem uso, e `Account.ownerUserId` já identifica o titular.
- [ ] **1.2** Contratos em `packages/shared`: `TeamMember`, `CompanyMember`, `UpdateMembershipRequest`, `DisableUserRequest`, `UpdateProfileRequest`. **Nenhuma interface de API no front.**
- [ ] **1.3** Migration só se as pendências exigirem (`Supplier`). O ciclo de vida já cabe no schema atual.
- [ ] **1.4** Novas ações de auditoria: `membership.role_changed`, `membership.removed`, `user.disabled`, `user.succeeded`.

### Fase 2 — Testes de backend (vermelhos primeiro)

- [ ] **2.1** Listagem da conta: só usuários da própria conta; a consultoria com carteira vê só as empresas do escopo dela.
- [ ] **2.2** Listagem por empresa: o Marcos vê a BRF e **não** a Seara; o Executor de várias empresas aparece em cada uma.
- [ ] **2.3** Troca de papel: respeita `CAN_INVITE` (D3); recusa papel acima da alçada; **recusa o segundo papel de escopo-empresa** com mensagem de negócio, não erro de banco.
- [ ] **2.4** Remoção de vínculo × desligamento de conta (D8): remover da BRF não desliga da Normatiza; desligar da conta derruba todos os vínculos e as sessões ativas.
- [ ] **2.5** Sucessão (D4): recusa tirar o último Gestor sem sucessor; aceita com sucessor; permite tirar Executor sem nada.
- [ ] **2.6** Desligar quem não se convidou funciona (D5); desligar o dono da conta é recusado (§4).
- [ ] **2.7** Perfil: o dono edita nome e telefone; **ninguém edita e-mail** (D7); ninguém edita o perfil de outro.
- [ ] **2.8** E2E dos endpoints novos, com os dois transportes já cobertos pela autenticação.

### Fase 3 — Implementação do backend

- [ ] **3.1** `GET /users` (conta, com filtros) e `GET /companies/:companyId/members`.
- [ ] **3.2** `PATCH /memberships/:id` — papel e tipo de executor.
- [ ] **3.3** `DELETE /memberships/:id` — remover da empresa.
- [ ] **3.4** `POST /users/:id/disable` — com `successorUserId` opcional, exigido só quando a invariante manda.
- [ ] **3.5** `PATCH /users/me` — perfil próprio.
- [ ] **3.6** `GET /invitations` — pendentes, para a coluna de status.
- [ ] **3.7** Auditoria em todas as mutações acima.

### Fase 4 — Testes de frontend (vermelhos primeiro)

- [ ] **4.1** Equipe (Contexto 1): lista, filtros, e **a lista de papéis oferecida reflete a alçada de quem olha**.
- [ ] **4.2** Equipe da Empresa: escopo pré-preenchido; o botão diz "Remover da empresa"; não há "desligar da conta".
- [ ] **4.3** Troca de papel: o conflito de papel de escopo-empresa é explicado **antes** do envio.
- [ ] **4.4** Desligamento: pede sucessor só quando é o caso; bloqueia o dono da conta.
- [ ] **4.5** Perfil: e-mail em leitura; salvar nome e telefone.
- [ ] **4.6** Admins da plataforma: lista, conceder, revogar.

### Fase 5 — Implementação do frontend

- [ ] **5.1** Rotas e itens de menu nos dois contextos.
- [ ] **5.2** Tela Equipe + formulário de convite (compartilhado com 5.3).
- [ ] **5.3** Tela Equipe da Empresa.
- [ ] **5.4** Fluxos de troca de papel e de desligamento com sucessão.
- [ ] **5.5** Meu Perfil.
- [ ] **5.6** Admins da plataforma.

### Fase 6 — Fechamento

- [ ] **6.1** Suíte completa verde (`test`, `test:e2e`, front).
- [ ] **6.2** Conferir que nenhuma regra é aplicada só no front.
- [ ] **6.3** Estender [`docs/backend/autenticacao.md`](../backend/autenticacao.md) com o ciclo de vida, ou abrir `docs/backend/equipe.md` se ficar grande demais.
- [ ] **6.4** Atualizar `docs/produto` com o que for decidido durante a implementação.
- [ ] **6.5** Apagar este arquivo e a linha no [README dos planos](./README.md).

---

## 7. Riscos

- **A invariante do índice parcial vai aparecer para o usuário.** Papel de escopo-empresa em um vínculo ativo só é garantido pelo Postgres. Se a tela não antecipar, o usuário vê erro de constraint. É o principal ponto de atrito de UX desta feature.
- **Sucessão é regra de negócio pouco exercitada.** "Não se remove o último Gestor sem sucessor" está escrito em [01 §5](../produto/01_papeis_e_permissoes.md) e nunca rodou. Provável que a implementação levante casos que o documento não previu — eles voltam para `docs/produto`, não se resolvem no código.
- ~~**`Supplier` inexistente pode contaminar o convite de terceiro**~~ — resolvido em D11: o campo não entra nesta feature.
- **E-mail é dependência externa nova.** Primeira do projeto. O modo de desenvolvimento sem chave (0.3) existe para que o time não fique refém dela.
- **Desligamento toca sessão ativa.** Precisa revogar refresh tokens junto, ou a pessoa desligada continua trabalhando por até 30 dias. O `TokenService.revokeAllForUser` já existe — falta chamá-lo.
