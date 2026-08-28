# Plano — Gestão de Equipe

> **Status:** Fases 0–5 concluídas — backend e frontend verdes (158 testes no front); falta só o fechamento · **Criado em:** 2026-08-26
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
| Listar usuários da conta | `GET /users`, com filtros de papel, empresa e status. |
| Listar quem tem acesso a uma empresa | `GET /companies/:companyId/members`. |
| Trocar papel / escopo | `PATCH /memberships/:id` · `DELETE /memberships/:id`. |
| Desligar usuário | `POST /users/:id/disable`, com `disable-preview` para a sucessão. |
| Envio de e-mail | Existe, opt-in explícito, ligado a convite e recuperação de senha. |
| Tela `/app/team` | Existe, com rota, item de menu e 23 testes. |
| Tela `/app/companies/:id/team` | Existe, com rota, item de menu e 11 testes. |
| `/app/profile` | Tela real: dados, senha e os próprios vínculos. 12 testes. |
| `/admin/admins` | Existe — listar e revogar. **Conceder depende de D19.** |
| `TeamService` (web) | Em `core/services/`, servindo as duas telas de equipe. |
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
| D5 | Desliga-se quem não se convidou | A alçada é **papel e escopo**, nunca a árvore de convites. Sem isto, um Executor convidado por alguém que já saiu ficaria ativo e órfão, sem ninguém com poder de encerrá-lo. [01 §5](../produto/01_papeis_e_permissoes.md) fecha as duas alçadas: remover da empresa é de "quem administra aquela empresa"; desligar da conta é "só o lado consultoria". |
| D16 | Ninguém muda o próprio papel | Nem para menos. `CAN_INVITE` impede subir acima do próprio teto, mas não impede um Gestor de se dar Engenheiro do Cliente por conta própria — e alçada que a pessoa se concede sozinha deixa de ser alçada. Mexer no próprio vínculo é pedido a quem está acima. |
| D18 | Sucessor herda do **mesmo lado**, e a remoção não cria empresa órfã | Duas regras que apareceram ao implementar. (a) O sucessor de um Gestor tem de já ter papel do lado cliente naquela empresa: oferecer a Carla, que é da consultoria, apagaria a fronteira entre quem produz a análise e quem responde pela empresa. (b) **Remover da empresa** recusa tirar a última pessoa com papel de escopo-empresa — sem isso, a porta dos fundos produziria exatamente o que D4 proíbe pela porta da frente. A recusa aponta o caminho certo (desligar com sucessão) em vez de só barrar. |
| D17 | Suceder **não** concede empresa nova | O sucessor precisa já ter vínculo ativo com a empresa em questão: a sucessão adiciona o papel que faltava, nunca o acesso à empresa. Conceder empresa como efeito colateral de um desligamento seria ampliar escopo sem ninguém ter convidado — e escondido dentro de outro ato. Quem não tem candidato elegível resolve convidando antes, que é o caminho visível. |
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

### Forma dos contratos

| # | Decisão | Definição |
| :-- | :--- | :--- |
| D13 | A alçada por linha vem do **servidor** | Cada linha das duas telas de equipe carrega `actions` — o que *quem está olhando* pode fazer com *aquela pessoa*. A alternativa é a tela recalcular a alçada, e ela **não tem os dados**: na Equipe da Empresa, D15 omite de propósito o escopo do outro, e sem ele não dá para saber se desligar aquela pessoa a deixaria sem acesso a alguma coisa. Mesmo onde os dados chegam, recalcular criaria uma segunda implementação de uma regra de autorização, em outra linguagem, que teria de ficar em dia com a primeira — justo o que a Fase 6.2 existe para impedir. Continua sendo decisão de interface: o servidor revalida em toda mutação. O que os booleanos evitam é **oferecer um botão que será recusado**. |
| D14 | Desligamento tem **consulta prévia** | `GET /users/:id/disable-preview` responde, antes de a tela oferecer qualquer coisa: pode desligar? exige sucessor? quem pode suceder? Sem isso, D4 obrigaria a tela a adivinhar quando a saída quebra uma invariante — e errar para pedir sucessor sempre (burocracia em 90% dos casos, que é o que D4 rejeita) ou para não pedir nunca (erro de servidor na cara do usuário). É a resposta ao segundo risco do §7. |
| D15 | Duas projeções, não uma filtrada | `TeamMember` tem `memberships[]`; `CompanyMember` **não tem**, nem `companyIds`, nem `isAccountOwner`. Não é economia de bytes: um `companyIds` na projeção de empresa conta ao Marcos que a Normatiza também atende a Seara. O isolamento do D1 precisa estar na **forma do contrato**, não na diligência de quem monta a tela. |

### Infraestrutura

| # | Decisão | Definição |
| :-- | :--- | :--- |
| D9 | E-mail pelo **Resend** | Domínio próprio, integração curta, plano grátis cobre desenvolvimento. Token em `RESEND_API_KEY`, validado no boot como os demais segredos. |
| D10 | Falha de e-mail não derruba a operação | Mesmo princípio da auditoria: o convite é criado, o e-mail vai para fila/log se falhar, e a tela oferece **reenviar**. Um provedor fora do ar não pode impedir o onboarding. |

---

## 4. Decisões pendentes

| # | Pergunta | Por que ela apareceu |
| :-- | :--- | :--- |
| D19 | **Como se concede acesso à plataforma?** | O §5.4 pede "conceder por e-mail". A API concede por `userId` (`POST /platform/admins`), e não existe — nem deveria existir sem ser decidido — nenhuma consulta de pessoa que **atravesse contas** no Contexto 0: ela seria um oráculo capaz de responder "quem trabalha na consultoria tal". Ou o Contexto 0 ganha uma busca própria, deliberada e auditada, ou a concessão passa a aceitar e-mail e resolve no servidor, sem devolver nada quando não achar. Enquanto não se decide, a Fase 4 testou listar e revogar, e **não** testou conceder — travar no teste um formulário cuja forma ainda não foi escolhida é decidir no código. A tabela do §5.4 também pede "Conta de origem", que `PlatformAdmin` não carrega; entra na mesma decisão. |

As duas que bloqueavam a Fase 1 foram resolvidas em D11 e D12, e a regra de negócio de D12 está escrita em [01 §5](../produto/01_papeis_e_permissoes.md).

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

- [x] **1.1** Confirmar que D11 e D12 não exigem migration. **Confirmado:** `Account.ownerUserId`, `User.disabledAt`, `succeededByUserId`, `lastAccessAt`, `invitedByUserId` e `Membership.supplierId` já existem no schema.
- [x] **1.2** Contratos em `packages/shared/src/team`: `TeamMember`, `CompanyMember`, `UpdateMembershipRequest`, `DisableUserPreview`, `DisableUserRequest`, `UpdateProfileRequest`, `ChangePasswordRequest`, `MemberActions`, `TeamListQuery` — mais `memberOrigin()`, a única regra derivada do lote.
- [x] **1.3** Migration: **nenhuma**. O ciclo de vida cabe inteiro no schema atual, e `Supplier` está fora do escopo por D11.
- [x] **1.4** Novas ações de auditoria: `membership.role_changed`, `membership.removed`, `user.disabled`, `user.succeeded`, `user.profile_updated`, `user.password_changed`.

> **Estado: verde.** 99 testes na API, build do front limpo. Nada mudou de comportamento — a fase é de contrato.
>
> Três decisões de forma apareceram ao desenhar as projeções e estão em D13, D14 e D15. As duas primeiras adicionam trabalho às fases seguintes (`actions` por linha, e o *preview* de desligamento); a terceira é o D1 movido para dentro do tipo.

### Fase 2 — Testes de backend (vermelhos primeiro)

- [x] **2.1** Listagem da conta: só usuários da própria conta; a consultoria com carteira vê só as empresas do escopo dela.
- [x] **2.2** Listagem por empresa: o Marcos vê a BRF e **não** a Seara; o Executor de várias empresas aparece em cada uma.
- [x] **2.3** Troca de papel: respeita `CAN_INVITE` (D3); recusa papel acima da alçada; **recusa o segundo papel de escopo-empresa** com mensagem de negócio, não erro de banco.
- [x] **2.4** Remoção de vínculo × desligamento de conta (D8): remover da BRF não desliga da Normatiza; desligar da conta derruba todos os vínculos e as sessões ativas.
- [x] **2.5** Sucessão (D4): recusa tirar o último Gestor sem sucessor; aceita com sucessor; permite tirar Executor sem nada.
- [x] **2.6** Desligar quem não se convidou funciona (D5); desligar o dono da conta é recusado (§4).
- [x] **2.7** Perfil: o dono edita nome e telefone; **ninguém edita e-mail** (D7); ninguém edita o perfil de outro; trocar a senha exige a senha atual.
- [x] **2.9** `actions` e *preview* (D13/D14) concordam com a mutação: o que vier `false` na listagem tem de ser recusado pelo endpoint correspondente, e o que o *preview* disser exigir sucessor tem de falhar sem ele. Um botão oferecido e recusado é o mesmo defeito que um botão escondido sem motivo.
- [x] **2.8** E2E **de transporte** dos endpoints novos — `test/team-http.e2e-spec.ts`, entregue junto da Fase 3 porque depende dos controladores. As regras de negócio ficam em `test/team.e2e-spec.ts`, no nível de serviço.

> **Estado: vermelho, como deve ser.** 20 testes de unidade (`member-policy.service.spec.ts`) e 40 e2e (`team.e2e-spec.ts`) falham contra esqueletos que só lançam. Os 99 testes que já existiam seguem verdes, e a API compila.
>
> **Por que os e2e batem no banco de verdade.** Duas das regras desta feature **são** do banco: o índice parcial que garante papel de escopo-empresa em um vínculo ativo só, e as chaves compostas que impedem qualquer coisa de atravessar contas. Um Prisma falso concordaria com o que eu escrevesse — inclusive com o que estivesse errado.
>
> **Três testes passaram na primeira execução e foram apertados.** Usavam `rejects.toBeDefined()`, que um `throw new Error('não implementado')` satisfaz: passariam contra qualquer implementação quebrada. Agora nomeiam a exceção esperada — e a de listar empresa fora do escopo é `NotFoundException`, não `ForbiddenException`, porque um 403 já contaria ao Marcos que existe algo ali para ser proibido.

### Fase 3 — Implementação do backend

- [x] **3.1** `GET /users` (conta, com filtros) e `GET /companies/:companyId/members`.
- [x] **3.2** `PATCH /memberships/:id` — papel e tipo de executor.
- [x] **3.3** `DELETE /memberships/:id` — remover da empresa.
- [x] **3.4** `POST /users/:id/disable` — com `successorUserId` opcional, exigido só quando a invariante manda.
- [x] **3.5** `PATCH /users/me` — perfil próprio; `POST /users/me/password` — troca da própria senha.
- [x] **3.6** `GET /invitations` — **dispensado**. O convite pendente já viaja dentro de `TeamMember.invitation`, que é onde a coluna de status o consome; uma segunda rota para o mesmo dado seria uma segunda verdade a manter em dia.
- [x] **3.7** Auditoria em todas as mutações acima.
- [x] **3.8** `GET /users/:id/disable-preview` (D14) e o cálculo de `actions` por linha (D13) — `MemberPolicyService` é a única resposta, e serve às duas projeções, ao *preview* e à validação da mutação.

> **Estado: verde.** 119 testes de unidade e 141 e2e. Os 60 vermelhos da Fase 2 fecharam sem que nenhum precisasse ser afrouxado.
>
> **Nenhuma rota carrega guarda de papel, e é de propósito.** A alçada desta feature não é "quem entra na tela", é "o que cada um pode fazer com **cada linha**" — pergunta que o `MemberPolicyService` responde por pessoa, dentro do serviço. Uma guarda na porta daria uma segunda resposta, mais grossa, para a mesma pergunta.
>
> **Duas invariantes foram traduzidas para linguagem de negócio antes de o banco reclamar:** o papel de escopo-empresa em duas empresas e a remoção do último Gestor. Os dois casos chegariam como erro de constraint ou como empresa órfã — o §7 chama isso de falha de desenho.

### Fase 4 — Testes de frontend (vermelhos primeiro)

- [x] **4.1** Equipe (Contexto 1): lista, filtros, e **a lista de papéis oferecida reflete a alçada de quem olha**.
- [x] **4.2** Equipe da Empresa: escopo pré-preenchido; o botão diz "Remover da empresa"; não há "desligar da conta".
- [x] **4.3** Troca de papel: o conflito de papel de escopo-empresa é explicado **antes** do envio.
- [x] **4.4** Desligamento: pede sucessor só quando é o caso; bloqueia o dono da conta.
- [x] **4.5** Perfil: e-mail em leitura; salvar nome e telefone.
- [x] **4.6** Admins da plataforma: lista e revogar. **Conceder ficou de fora** — depende de D19.

> 61 testes vermelhos, em cinco arquivos. Os esqueletos existem para que os testes compilem e falhem pelo motivo certo; nenhum deles decide nada. Os `data-testid` usados são o contrato que a Fase 5 precisa honrar.

### Fase 5 — Implementação do frontend

- [x] **5.1** Rotas e itens de menu nos dois contextos.
- [x] **5.2** Tela Equipe + formulário de convite (compartilhado com 5.3).
- [x] **5.3** Tela Equipe da Empresa.
- [x] **5.4** Fluxos de troca de papel e de desligamento com sucessão.
- [x] **5.5** Meu Perfil.
- [x] **5.6** Admins da plataforma — listar e revogar. A concessão espera D19.

> Os 61 vermelhos fecharam sem que nenhum precisasse ser afrouxado.
>
> **Duas peças ficaram em `shared/components/team/`** por serem exercidas pelas
> duas telas de equipe: o formulário de convite e o editor de papéis. A
> diferença entre os dois contextos não é o formulário — é o escopo, e ela cabe
> num `input`.
>
> **As telas usam os componentes do PrimeNG**, como manda o
> [design system](../web/design_system.md): `p-table`, `p-select`, `p-checkbox`,
> `p-dialog`, `pInputText`, `p-button`, `p-message`.
>
> A primeira versão desta fase foi escrita com elementos nativos, sob a
> justificativa de que o `p-dialog` dependia de animações ausentes no teste e
> montava o conteúdo fora da árvore do componente. **As duas coisas eram
> falsas** e foram verificadas depois: o `primeng-dialog` da v21 não importa
> `@angular/animations`, e `overlayAppendTo` já vem como `'self'`. O que
> faltava era só `window.matchMedia`, que o jsdom não tem — resolvido em
> `src/test-setup.ts`, registrado no `angular.json`.
>
> Como se aperta cada componente num teste está em
> `core/testing/prime.ts`, num lugar só: um `p-select` não responde a
> `.value = 'MANAGER'`, e esse detalhe não pode estar espalhado por quatro
> arquivos de teste.

### Fase 6 — Fechamento

- [ ] **6.1** Suíte completa verde (`test`, `test:e2e`, front). *Parcial: 119 unitários e 158 do front verdes; falta rodar `test:e2e` no fechamento.*
- [ ] **6.2** Conferir que nenhuma regra é aplicada só no front.
- [ ] **6.3** Estender [`docs/backend/autenticacao.md`](../backend/autenticacao.md) com o ciclo de vida, ou abrir `docs/backend/equipe.md` se ficar grande demais. **Levar junto o índice D1–D15**: o código já cita `(D8)`, `(D12)`, `(D13)` em comentário, e apagar este plano sem o índice deixa essas siglas sem referente — foi o motivo do §14 da autenticação.
- [ ] **6.4** Atualizar `docs/produto` com o que for decidido durante a implementação.
- [ ] **6.5** Apagar este arquivo e a linha no [README dos planos](./README.md).

---

## 7. Riscos

- **A invariante do índice parcial vai aparecer para o usuário.** Papel de escopo-empresa em um vínculo ativo só é garantido pelo Postgres. Se a tela não antecipar, o usuário vê erro de constraint. É o principal ponto de atrito de UX desta feature.
- ~~**A invariante do índice parcial vai aparecer para o usuário**~~ — mitigada em D13/D14 no que dá: `actions` esconde o que será recusado e o *preview* explica a sucessão antes do envio. O conflito de papel de escopo-empresa, porém, **continua de pé** — ele depende do papel escolhido no formulário, que nenhuma consulta prévia antecipa. Resolve-se em 2.3, com mensagem de negócio.
- **Sucessão é regra de negócio pouco exercitada.** "Não se remove o último Gestor sem sucessor" está escrito em [01 §5](../produto/01_papeis_e_permissoes.md) e nunca rodou. Provável que a implementação levante casos que o documento não previu — eles voltam para `docs/produto`, não se resolvem no código.
- ~~**`Supplier` inexistente pode contaminar o convite de terceiro**~~ — resolvido em D11: o campo não entra nesta feature.
- **E-mail é dependência externa nova.** Primeira do projeto. O modo de desenvolvimento sem chave (0.3) existe para que o time não fique refém dela.
- **Desligamento toca sessão ativa.** Precisa revogar refresh tokens junto, ou a pessoa desligada continua trabalhando por até 30 dias. O `TokenService.revokeAllForUser` já existe — falta chamá-lo.
