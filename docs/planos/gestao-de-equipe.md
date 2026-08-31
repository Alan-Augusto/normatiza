# Plano — Gestão de Equipe

> **Status:** Fases 0–5 e 7 concluídas — 212 testes no front, 125 unitários e 150 e2e na API · falta 6.2–6.5 e o roteiro de aceite (7.9) · **Criado em:** 2026-08-26
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
| `/admin/admins` | Existe — listar, conceder por e-mail exato e revogar. |
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

Nenhuma. As duas que bloqueavam a Fase 1 viraram D11 e D12; **D19 e D20** fecharam com a tabela compartilhada, e **D21–D24** com a Fase 7.

### Decididas

| # | Decisão | Definição |
| :-- | :--- | :--- |
| D19 | Concessão de admin **por e-mail exato** | `POST /platform/admins` passa a receber `{ email }` e resolve no servidor. Sem busca por trecho: não por sigilo — o Contexto 0 enxerga as contas por definição —, mas porque busca parcial é varredura do cadastro inteiro, e quem promove alguém já sabe o endereço. E-mail sem dono é recusa explícita (promover quem não tem conta seria um convite de plataforma, fluxo próprio que não existe). E-mail que alcança **duas** pessoas devolve 409 com os candidatos e a **conta** de cada uma — `User.email` é único por conta, não globalmente, a mesma ambiguidade do login (D16). Pessoa desligada é recusada: o acesso não sobrevive ao desligamento, e conceder gravaria linha inerte. Regra de negócio em [01](../produto/01_papeis_e_permissoes.md). |
| D20 | Ver a equipe ≠ poder convidar | Duas capacidades, não uma. Vê a lista todo papel com posição na empresa — Técnico e Diretor inclusive —, já recortada pelo escopo de quem pergunta; o Executor fica de fora. **E a lista é a da empresa, não a da conta que a atende** — o recorte é D25. O que some para quem não concede papel nenhum é **o botão**, não a tela: `CAN_INVITE` vazio abriria um formulário sem uma única opção, e oferecer o que será recusado é o mesmo gesto do botão cinza. Amarrar a visibilidade a "quem convida" tiraria da Débora — Diretora, que não convida ninguém — a lista de quem tem acesso à empresa dela, que numa ferramenta de conformidade é material de auditoria. Regra de negócio em [01](../produto/01_papeis_e_permissoes.md). |

| # | Decisão | Definição |
| :-- | :--- | :--- |
| D21 | O papel se escolhe numa **lista agrupada por lado**, e some quando não há escolha | Três formas, decididas pelo tamanho de `CAN_INVITE` de quem convida: **um** papel é declarado, não perguntado (Carla, Antonio); **vários de um lado** viram lista ordenada por alçada (Marcos); **vários dos dois lados** ganham um título por lado (só o Josué). **Não são abas**: só o Eng. Responsável alcança os dois lados, então a aba existiria para uma única pessoa do sistema — e esconderia metade das opções das demais, podendo deixar o papel escolhido numa aba fechada. A **descrição fica nos três casos**: não escolher não é não precisar saber. Ordem por alçada, nunca alfabética. Regra em [01 §4](../produto/01_papeis_e_permissoes.md). |
| D22 | A Equipe da Empresa **agrupa por origem, e o bloco se chama pelo nome** | Com contagem em pessoas, e a coluna "Origem" sai — dentro de cada bloco ela repetiria o mesmo valor linha após linha. **O título é o nome de quem está ali** — *BRF · 3 pessoas*, *Normatiza · 2 pessoas* —, nunca a classificação: "Cliente" é a palavra da consultoria para a BRF, e escrita na tela da BRF ela conta de que lado o sistema foi escrito, que é o vazamento de vocabulário que o D1 existe para impedir. A Débora leria *"Cliente · 4"* sobre a própria equipe. Só o terceiro continua classificado — *Terceiros contratados* —, e por falta de dado: a empresa prestadora não existe no sistema (D11). Custa uma capacidade nova no `app-data-table` — `agruparPor`, via o `rowGroupMode` do próprio `p-table`. |
| D23 | A descrição do papel mora em `packages/shared` | `ROLE_SUMMARY` (o que faz), `ROLE_LIMIT` (o que **não** faz) e `ROLE_ORDER` (a ordem de alçada), ao lado de `ROLE_LABEL`. Três consumidores: o convite, Meu Perfil e o guia `app-role-guide`. O "não" existe separado porque metade das regras deste sistema é negativa — *"o Eng. do Cliente nunca toca na análise"* é exatamente a dúvida de quem escolhe um papel. |
| D24 | O convite passa a **reactive forms tipado** | Validade por campo, estado `touched` e erro ao lado do campo não têm onde morar em `ngModel` sobre sinal. Sem isso, e-mail malformado só era recusado pelo servidor e voltava como frase genérica no rodapé, longe do campo que a causou. O e-mail é **aparado antes de validar** — `Validators.email` é ancorado, e a terceira ocorrência desse mesmo defeito no sistema. |
| D25 | A lista do cliente é **a da empresa dele** | Quem olha do lado cliente recebe gente da empresa e os terceiros que ela contratou; a consultoria sai da tabela e vira **uma linha de contexto** — quem presta o serviço e quem assina por ele, com nome e registro. O argumento de D20 (*"quem tem acesso é material de auditoria"*) não sobrevive à troca do dono do dado: nome, e-mail e último acesso de funcionário da consultoria são dado pessoal **dela**, exposto a um terceiro que não os contratou, não os administra e não pode agir sobre nenhum deles. O caso mais claro é o **último acesso** — se a Carla não entra há cinco dias, a BRF infere que ninguém está tocando no serviço dela: informação comercial vazando pelo painel do cliente, e nenhuma finalidade de registro de acesso pede carimbo de hora. **Saber que existe um terceiro com acesso ≠ receber o cadastro dele**, e separar em dois campos (`members` × contexto) é o que impede uma coisa de virar a outra. **Nomear o responsável técnico não é o mesmo vazamento:** esse nome e esse registro vão impressos no laudo assinado — é o objeto do contrato, não o organograma da consultoria; por isso só os papéis que **assinam** (`SIGNING_ROLES`), e o Técnico fica de fora. **O recorte é no servidor, por quem pergunta** (é o que a Fase 6.2 confere): filtrar no template deixaria os dados viajando até o navegador do cliente, legíveis no inspetor. A consultoria dentro da empresa continua recebendo todo mundo em `members`, porque ali é a própria equipe. Regra em [01 §4](../produto/01_papeis_e_permissoes.md). |

A regra de negócio de D12 está escrita em [01 §5](../produto/01_papeis_e_permissoes.md).

> Ainda em aberto, mas fora do escopo desta feature: a tabela do §5.4 pede "Conta de origem" na lista de admins, e `PlatformAdmin` não carrega esse campo.

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

**Tabela:** Nome · Papel · Último acesso · Status — em blocos por origem, cada um intitulado pelo **nome** de quem está nele (D22).
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
- [x] **4.6** Admins da plataforma: lista e revogar. Conceder por e-mail entrou depois, com D19 decidida.

> 61 testes vermelhos, em cinco arquivos. Os esqueletos existem para que os testes compilem e falhem pelo motivo certo; nenhum deles decide nada. Os `data-testid` usados são o contrato que a Fase 5 precisa honrar.

### Fase 5 — Implementação do frontend

- [x] **5.1** Rotas e itens de menu nos dois contextos.
- [x] **5.2** Tela Equipe + formulário de convite (compartilhado com 5.3).
- [x] **5.3** Tela Equipe da Empresa.
- [x] **5.4** Fluxos de troca de papel e de desligamento com sucessão.
- [x] **5.5** Meu Perfil.
- [x] **5.6** Admins da plataforma — listar e revogar. A concessão por e-mail entrou depois, com D19 decidida.

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

- [x] **6.1** Suíte completa verde (`test`, `test:e2e`, front) — 125 unitários, 150 e2e e 212 no front, rodadas juntas depois de D25.
- [ ] **6.2** Conferir que nenhuma regra é aplicada só no front.
- [ ] **6.3** Estender [`docs/backend/autenticacao.md`](../backend/autenticacao.md) com o ciclo de vida, ou abrir `docs/backend/equipe.md` se ficar grande demais. **Levar junto o índice D1–D15**: o código já cita `(D8)`, `(D12)`, `(D13)` em comentário, e apagar este plano sem o índice deixa essas siglas sem referente — foi o motivo do §14 da autenticação.
- [ ] **6.4** Atualizar `docs/produto` com o que for decidido durante a implementação.
- [ ] **6.5** Apagar este arquivo e a linha no [README dos planos](./README.md).

### Fase 7 — Adequação de usabilidade

> **Ordem obrigatória: definir → redesenhar → ajustar teste.** Mexer no teste antes de a interface parar de mudar é pagar o mesmo trabalho duas vezes. Os passos 7.1 e 7.2 não produzem código.

**O problema, na frase de quem usa:** *"estou meio perdido com tanto papel diferente."* Não é falta de informação — é que o sistema **nomeia** papéis sem nunca dizer o que cada um faz, e pede que a pessoa classifique alguém num organograma quando o que ela tem na cabeça é *"quero que o Rafael receba tarefas"*.

#### 7.1 — Fechar D21–D24

#### 7.2 — A regra de superfície: **o que não varia não aparece**

Uma coluna cujo valor é igual em todas as linhas **para quem está olhando** não é informação, é ruído. Vale igualmente para a coluna de ações vazia e para a pergunta de resposta única.

| Quem olha | Tela | O que **some** | Por quê |
| :--- | :--- | :--- | :--- |
| Fernando · Técnico | Equipe | Coluna **Escopo** e coluna de **ações** | O escopo dele é uma empresa: toda linha diria "BRF". `actions` vem tudo `false` (D13). |
| Carla · Eng. Consultoria | Equipe | — | Carteira com duas empresas: o escopo varia, e ela age sobre Técnicos. |
| Débora · Diretora | Equipe da Empresa | Coluna de **ações** e o botão de convite (D20) | Leitura pura. A lista fica: é material de auditoria. |
| Antonio · Eng. do Cliente | Equipe da Empresa | O **seletor de papel** inteiro | `CAN_INVITE.CLIENT_ENGINEER = ['EXECUTOR']`. |
| Marcos · Gestor | Equipe da Empresa | Abas de lado | Os três papéis que ele concede são todos do lado cliente. |

> É a mesma regra que já esconde o seletor de empresas no Contexto 2 (`invite-form.component.ts`): *uma lista de uma opção só é uma pergunta encenada*. A Fase 7 aplica ao campo ao lado.

#### 7.3 — O convite deixa de ser um formulário de cadastro

Três formas, decididas pelo tamanho de `CAN_INVITE` de quem convida — não por configuração de tela:

| Papéis que ele concede | Quem é | A forma |
| :-: | :--- | :--- |
| **1** | Carla, Antonio | Sem escolha. O título diz o que vai acontecer — *"Convidar um executor para a BRF"* — e um bloco descreve o papel. Para o Antonio o formulário inteiro vira **nome · e-mail · interno ou terceiro**. |
| **3, um lado** | Marcos | Lista de opções, uma linha de descrição em cada, ordenada por **alçada**. |
| **6, dois lados** | Josué | A mesma lista, com dois títulos de grupo: *Na minha consultoria* · *Na empresa cliente*. |

**Por que não abas** (D21): só o Eng. Responsável alcança os dois lados — a aba existiria para **uma** pessoa do sistema, a mais experiente. E aba esconde metade das opções: quem abrir no lado errado precisa descobrir que existe outro, e o papel escolhido pode ficar numa aba fechada, com o formulário exibindo um estado que ninguém vê.

**Ordem por alçada, nunca alfabética.** É a ordem do `type Role` e a da tabela do §4 de [01](../produto/01_papeis_e_permissoes.md). Alfabética põe *Diretor* — leitura pura — acima de *Gestor*, e sugere hierarquia onde não há.

#### 7.4 — A descrição do papel, num lugar só (D23)

Dois campos por papel, em `packages/shared`: o que faz e o que **não** faz. O "não" é metade das regras deste sistema — *"o Eng. do Cliente nunca toca na análise"*, *"o Executor não vê o HRN nem as outras máquinas"* — e é exatamente o que dissolve a confusão de quem convida.

Três consumidores da mesma cópia:

1. **O convite**, para decidir.
2. **Meu Perfil**, para o Rafael entender o que ele *é* no sistema — hoje a tela lista o vínculo e não explica nada.
3. **Um diálogo "o que cada papel faz"**, aberto por um link discreto nas duas telas de equipe. É a resposta única a "estou perdido com tanto papel".

> O papel numa tabela é um selo. Explicar por `title`/*hover* não serve: é o anti-padrão de prioridade 2 da base do `ui-ux-pro-max` — *reliance on hover only* —, morre no toque e não existe para leitor de tela. Daí o diálogo, que funciona nos três.

#### 7.5 — Formulário: erro ao lado do campo (D24)

O que a base de UX aponta como **High** e hoje falha:

- **Error Placement** — o convite tem um erro só, no rodapé. E-mail malformado nem é validado no cliente: vira 400 e uma frase genérica longe do campo que a causou.
- **Content Jumping** — o aviso de "escopo de mais de uma empresa" nasce e some empurrando o botão. O espaço tem de estar reservado.
- **Error Messages** — o erro precisa de `role="alert"` e `aria-describedby` ligando ao campo.
- **Alvo de toque** — a opção de papel se clica na linha inteira, não no ponto, com 44px de altura.
- Validar em `blur` com `touched`, não a cada tecla nem só no envio.

#### 7.6 — Depois, e só depois, os testes

**A maior parte não muda, e isso não é sorte.** Os testes de equipe afirmam **regras**, não a marcação: *"à Carla só se oferece Técnico"*, *"a Débora não vê o botão"*, *"o botão diz Remover da empresa"*. O acoplamento ao `p-select` está inteiro em duas funções de `core/testing/prime.ts` — `opcoesDe` e `escolher`. Trocado o seletor por lista de opções, essas duas mudam **num arquivo**, e as afirmações de regra sobrevivem literalmente.

| Tipo | Exemplo | Fase 7 |
| :--- | :--- | :--- |
| **Regra** | `opcoesDe('convite-papel') === ['Técnico']` | Sobrevive. Se quebrar, é regressão de verdade. |
| **Forma** | ordenação alfabética; o campo ser um `select` | Muda — afirmava a implementação. |

**O risco de reaproveitar `opcoesDe`:** um ajudante que lê tanto a lista quanto o papel declarado pode mascarar a ausência do texto. Mitigação: um teste dedicado por forma — *"com um papel só, não há escolha a fazer"* e *"com vários, há uma lista"* —, e as regras continuam pelo ajudante.

- [x] **7.1** Fechar D21–D24.
- [x] **7.2** `ROLE_SUMMARY` / `ROLE_LIMIT` e `ROLE_ORDER` em `packages/shared`, com o texto conferido contra [01 §4](../produto/01_papeis_e_permissoes.md).
- [x] **7.3** Seletor de papel nas três formas; `app-role-guide` compartilhado.
- [x] **7.4** Colunas e ações que somem quando não variam (7.2), nas duas telas.
- [x] **7.5** Agrupamento por origem na Equipe da Empresa (D22) — `agruparPor` no `app-data-table`, sobre o `rowGroupMode` do `p-table`.
- [x] **7.6** Convite em *reactive forms* tipado, com erro por campo (D24).
- [x] **7.7** Meu Perfil explica o papel de quem está lendo.
- [x] **7.8** Ajustar os testes de **forma**; conferir que nenhum de **regra** precisou ceder.
- [ ] **7.9** Roteiro de aceite manual, por fluxo — incluindo o que **não** pode aparecer.

> **Estado: verde.** 208 testes no front (eram 187), 125 unitários e 147 e2e na
> API, build limpo.
>
> **Nenhum teste de regra precisou ceder, e a previsão de que a maioria
> sobreviveria se confirmou.** O acoplamento ao `p-select` estava inteiro em
> `opcoesDe` e `escolher`, em `core/testing/prime.ts`: os dois passaram a ler
> também a lista marcada com `data-opcao`, e os seis pontos de teste que
> afirmam alçada continuaram como estavam. Mudaram **dois**, os dois de forma —
> o que afirmava a coluna "Origem", que virou bloco, e nada mais. A ordenação
> alfabética que eu previa quebrar **não existia**: o teste chamava `.sort()`
> antes de comparar, então nunca afirmou ordem nenhuma. Agora afirma, e a ordem
> é a de alçada.
>
> **Um defeito real foi pego pelos testes de regra**, e é o argumento a favor
> deles: a primeira versão de `rolesBySide` reaplicava `CAN_INVITE` a uma lista
> que já era o resultado dele — ao Gestor, que concede três papéis, sobrava
> **um**. O resultado era plausível o bastante para passar numa conferência
> visual. Quem reprovou foi *"ao Gestor se oferecem os papéis que ele
> concede"*, escrito antes de qualquer uma destas telas existir.
>
> `packages/shared` não tem executor de teste; a garantia de `rolesBySide` vive
> em `invite-form.component.spec.ts`, que exercita exatamente o caso que
> quebrou.

---

## 7. Riscos

- **A invariante do índice parcial vai aparecer para o usuário.** Papel de escopo-empresa em um vínculo ativo só é garantido pelo Postgres. Se a tela não antecipar, o usuário vê erro de constraint. É o principal ponto de atrito de UX desta feature.
- ~~**A invariante do índice parcial vai aparecer para o usuário**~~ — mitigada em D13/D14 no que dá: `actions` esconde o que será recusado e o *preview* explica a sucessão antes do envio. O conflito de papel de escopo-empresa, porém, **continua de pé** — ele depende do papel escolhido no formulário, que nenhuma consulta prévia antecipa. Resolve-se em 2.3, com mensagem de negócio.
- **Sucessão é regra de negócio pouco exercitada.** "Não se remove o último Gestor sem sucessor" está escrito em [01 §5](../produto/01_papeis_e_permissoes.md) e nunca rodou. Provável que a implementação levante casos que o documento não previu — eles voltam para `docs/produto`, não se resolvem no código.
- ~~**`Supplier` inexistente pode contaminar o convite de terceiro**~~ — resolvido em D11: o campo não entra nesta feature.
- **E-mail é dependência externa nova.** Primeira do projeto. O modo de desenvolvimento sem chave (0.3) existe para que o time não fique refém dela.
- **Desligamento toca sessão ativa.** Precisa revogar refresh tokens junto, ou a pessoa desligada continua trabalhando por até 30 dias. O `TokenService.revokeAllForUser` já existe — falta chamá-lo.
