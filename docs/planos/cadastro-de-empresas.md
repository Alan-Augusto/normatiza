# Plano — Cadastro de Empresas

> **Status:** Fases 0–5 concluídas — 157 unitários e 220 e2e na API, 287 no front · falta o fechamento (6): aceite no navegador e Firebase de verdade · **Criado em:** 2026-09-23
> **Regras de negócio:** [01 — Papéis §4 e §5](../produto/01_papeis_e_permissoes.md) · [03 — Navegação §3.2 e §4.0](../produto/03_navegacao_e_telas.md) · [04 — Modelo de Dados §1 e §2](../produto/04_modelo_de_dados.md) · [05 — Regras Transversais §4](../produto/05_regras_transversais.md)
> **Padrões herdados:** [Gestão de Equipe](./gestao-de-equipe.md) — `actions` por linha (D13), duas projeções (D15), `app-data-table`, reactive forms tipado (D24)

---

## 1. Objetivo

Substituir a lista provisória de `/app/empresas` pelo cadastro de verdade: **listar, buscar, cadastrar, editar, desativar e reativar** empresas — e dar ao lado cliente uma forma de ver os dados da própria empresa sem editá-los.

Escopo desta feature:

- Modelo completo de `Company` (doc 04 §2), `CompanyGroup` e `FileAsset`.
- Storage de arquivos (Firebase), começando pelo logo.
- Ciclo de status da empresa (implantação → aguardando Gestor → ativa → inativa).
- Vínculo automático na criação (quem cria + Engenheiros Responsáveis).
- Modo leitura da empresa inativa, imposto pelo servidor.
- Tela de lista, formulário (novo/editar) e diálogo de dados na sidebar.
- Preenchimento automático por CNPJ e CEP.

**Fora do escopo:** o cálculo real de Equipamentos, Pontos em aberto, % de adequação e Última análise (as colunas nascem aqui, os números chegam com equipamentos e análises); a trava de concluir análise em empresa não ativa (a regra está escrita em 01 §4, o código nasce com a feature de análise); relatórios por grupo; thumbnails e compressão de fotos.

---

## 2. Estado atual

| Item | Situação |
| :--- | :--- |
| `Company` no Prisma | Só `corporateName`, `tradeName`, `document`, `isActive`. `@@unique([accountId, document])` já existe. |
| `CompanyGroup`, `FileAsset` | Não existem. |
| Storage de arquivos | Não existe nada. |
| `GET /companies` | Não existe. A tela lê a carteira da sessão (`memberships[].company`). |
| Tela `/app/empresas` | Provisória, com aviso na tela. Lista de links. |
| `CompanySummary` (sessão) | `id`, `tradeName`, `corporateName`, `isActive`. Lido pelo layout da empresa, pela sidebar e pela Equipe. |
| Seed | BRF e Seara com os campos mínimos. |
| Escopo do Eng. Responsável | Feito só de vínculos — não há "vê todas" implícito. |

---

## 3. Decisões travadas

### Onde as telas vivem

| # | Decisão | Definição |
| :-- | :--- | :--- |
| D1 | Lista em **tabela**, não cartões | Lista de comparação, ordenável, para carteiras de centenas. Usa `app-data-table`. Cartões ficam para equipamentos, onde a foto é informação. Regra em [03 §3.2](../produto/03_navegacao_e_telas.md). |
| D2 | Formulário em **página própria** | `/app/empresas/nova` e `/app/empresas/:companyId/editar`, **um componente** com dois modos. Ambas no Contexto 1, declaradas **antes** de `companies/:companyId` no `app.routes.ts` — senão o layout da empresa as captura. Diálogo foi descartado: cinco seções, upload e buscas automáticas rolam por dentro, se perdem num ESC e não têm URL. |
| D3 | Dados da empresa num **diálogo de leitura** na sidebar | Clicar no nome da empresa abre texto formatado, sem input. Consultoria vê também grupo, código interno, observações e **Editar**; cliente não. Regra em [03 §4.0](../produto/03_navegacao_e_telas.md). |

### Colunas, busca e filtros

| # | Decisão | Definição |
| :-- | :--- | :--- |
| D4 | Todas as colunas **desde já** | Nome fantasia (razão social abaixo) · CNPJ · Cidade/UF · Gestor · Equipamentos · % de adequação · Pontos em aberto · Última análise · Status. Os campos já existem no contrato; só o cálculo chega depois. |
| D5 | **"—" em vez de zero inventado** | `equipmentsCount` e `openPointsCount` são `number` (0 é verdade). `adequacyPercent` e `lastAnalysisAt` são opcionais e aparecem como "—": "0% adequada" afirmaria algo falso. |
| D6 | Busca e filtros **no servidor** | `GET /companies?q=&status=`. Busca em todos os campos cadastrados, **menos observações**, sem distinguir acento nem maiúscula, e CNPJ/CEP comparados só por dígitos. No servidor porque a ordenação por % de adequação depende de números que só ele calcula, e porque a busca pelo nome do Gestor atravessa vínculos. **Filtra em memória a carteira já recortada**, com o mesmo `normalizeForSearch` de `@normatiza/shared` — carteira é de centenas, não de milhões, e isso dispensa `unaccent` e SQL cru. Paginação e busca no banco ficam para quando alguma carteira pedir. O filtro por grau de adequação entra junto com o dado: filtrar uma coluna que é "—" em todas as linhas devolveria tudo ou nada. |
| D7 | Estado da lista **na URL** | `q`, `status` e ordenação em query params. "Voltar" do Contexto 2 encontra a lista como estava. |

### Ciclo de vida

| # | Decisão | Definição |
| :-- | :--- | :--- |
| D8 | Status **calculado**, só a desativação gravada | `isActive` sai; entram `deactivatedAt` e `deactivatedByUserId`. `IMPLANTATION`, `AWAITING_MANAGER` e `ACTIVE` são derivados dos vínculos com `MANAGER` e do estado do usuário/convite. O convite **expira por tempo, sem evento** — um status gravado mentiria até a próxima escrita. Regra em [04 §2](../produto/04_modelo_de_dados.md). |
| D9 | Cadastro **não exige Gestor** | A empresa nasce em implantação. Após salvar, a tela oferece convidar o Gestor (o convite existente, com a empresa já preenchida). |
| D10 | Vínculo automático na criação | Mesma transação: `Membership` de quem criou + de cada `LEAD_ENGINEER` ativo da conta, com o papel de consultoria que cada um já tem. Por **papel**, nunca pela árvore de convites. Invariante 6 de [04 §1](../produto/04_modelo_de_dados.md). |
| D11 | Inativa = **modo leitura no servidor** | Uma verificação única, reusada por toda mutação que recebe `companyId` (convite, vínculo, e as futuras de equipamento e análise), recusa com mensagem de negócio. Leituras e download de laudo seguem. |
| D12 | Quem desativa/reativa | `LEAD_ENGINEER` e `CONSULTANT_ENGINEER`, dentro do escopo. Reativar recalcula o status (ativa ou em implantação). |
| D13 | Fora do escopo é **404**, não 403 | Mesma regra da Equipe: um 403 contaria à Carla que existe uma empresa ali. |

### Contratos

| # | Decisão | Definição |
| :-- | :--- | :--- |
| D14 | Duas projeções de detalhe | `CompanyDetail` (consultoria) e `CompanyProfile` (cliente). A do cliente **não tem** `group`, `externalCode` nem `notes` — o recorte está na forma do tipo, como no D15 da Equipe, e não no template. |
| D15 | `actions` por linha | `CompanyListItem.actions`: `edit`, `deactivate`, `reactivate`. A tela não recalcula alçada. |
| D16 | Campos planos no banco | `contact*` e `address*` como colunas, não JSON: a busca do D6 e os filtros por cidade/UF precisam indexar. O contrato em `@normatiza/shared` continua aninhado (`contact`, `address`), como no doc 04. |
| D17 | CNPJ validado nos dois lados | `isValidCnpj()` e `onlyDigits()` em `packages/shared`. Gravado **só com dígitos**; formatado na tela. |
| D18 | Obrigatórios à risca do doc 04 | Razão social, nome fantasia, CNPJ, nome e e-mail do contato, CEP, logradouro, número, bairro, cidade, UF. O resto é opcional. |
| D19 | Sessão passa a carregar `status` | `CompanySummary.isActive` vira `status: CompanyStatus`. Quem lia `isActive` passa a ler `status !== 'INACTIVE'`. |

### Grupo empresarial

| # | Decisão | Definição |
| :-- | :--- | :--- |
| D20 | Criado no próprio cadastro | Campo de texto com sugestões (`<datalist>` nativo) e o aviso "Grupo novo — será criado ao salvar" quando o nome não corresponde a nenhum conhecido. Nativo, e não o autocomplete do PrimeNG, porque o grupo é **texto livre** resolvido pelo nome no servidor: sugestão, teclado e leitor de tela vêm prontos. `GET /company-groups?q=` devolve só grupos com empresa **na carteira** de quem pergunta. |
| D21 | Nome repetido é **reaproveitado sem ser revelado** | Único na conta por nome normalizado (sem acento/maiúscula). Criar um nome que já existe fora da carteira reutiliza o grupo em silêncio — sem duplicar e sem contar à Carla que o grupo existe. |

### Arquivos e integrações

| # | Decisão | Definição |
| :-- | :--- | :--- |
| D22 | `StorageService` como interface | Duas implementações: `memory` (padrão em dev e teste) e `firebase`. Escolhida por `STORAGE_DRIVER`, validado no boot como o `MAIL_TRANSPORT`. Com `firebase`, exige `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`, `FIREBASE_STORAGE_BUCKET`. O Firebase pode ser configurado depois sem quebrar nada. |
| D23 | Upload pela API, leitura por URL assinada | Regra em [05 §4](../produto/05_regras_transversais.md). Caminho no bucket: `accounts/{accountId}/companies/{companyId}/logo/{fileId}`. |
| D24 | Logo: PNG, JPG, WebP até 2 MB | Tipo conferido pelos *magic bytes*, não pela extensão. **SVG recusado.** Trocar o logo cria um `FileAsset` novo; o anterior não é apagado (laudo antigo pode referenciá-lo). |
| D25 | CNPJ e CEP pela **BrasilAPI**, no front, em services isolados | `core/services/external/cnpj-lookup.service.ts` e `cep-lookup.service.ts`, com ViaCEP como segunda tentativa de CEP. Gratuitas, sem chave. Nenhum outro service chama API externa. Tempo limite curto; falha libera os campos com aviso. **Só preenchem campos vazios.** |

---

## 4. Decisões pendentes

Nenhuma. Se surgir decisão de negócio durante a implementação, ela vai para `docs/produto` antes do código.

---

## 5. As telas

> Todas seguem o [Roteiro de Implementação](../web/roteiro_implementacao.md): sem cabeçalho local, `label` e `subtitle` na rota, tokens semânticos, `rem`, dark mode, Lucide dentro das páginas.

### 5.1. Empresas — Contexto 1

**Rota:** `/app/empresas` · **Guarda:** `roleGuard(CONTEXTO_1)` · **Quem usa:** Josué, Carla, Fernando

- Barra superior: busca (um campo), filtro de status, botão **Nova empresa** (some para o Técnico).
- `app-data-table` com as colunas do D4. Status como selo. Clicar na linha → `/app/empresas/:id/painel`.
- Menu por linha a partir de `actions`: Editar · Desativar / Reativar (com confirmação que diz "a empresa fica em modo leitura").
- Estado vazio: "Nenhuma empresa na sua carteira" + ação "Cadastrar a primeira empresa" (quando pode). Busca sem resultado tem mensagem própria, distinta da carteira vazia.
- **Regra de superfície:** coluna que não varia para quem olha sai (o Fernando, só com a BRF, não precisa de filtro de status com uma opção).

### 5.2. Formulário — novo e editar

**Rotas:** `/app/empresas/nova` · `/app/empresas/:companyId/editar` · **Guarda:** `LEAD_ENGINEER`, `CONSULTANT_ENGINEER`

Seções: Identificação · Endereço · Contato técnico · Agrupamento e metadados · Logo.

- CNPJ primeiro: ao completar um CNPJ válido, busca na BrasilAPI e preenche o que estiver vazio.
- CEP: ao completar, busca e preenche logradouro, bairro, cidade e UF vazios.
- Contato: botão **Usar dados do Gestor** só quando a empresa já tem Gestor (edição).
- Grupo: autocomplete com criação inline (D20/D21).
- Logo: pré-visualização, trocar, remover.
- Erro ao lado do campo (D24 da Equipe). CNPJ duplicado na conta vem do servidor e aparece **no campo CNPJ**, não no rodapé.
- Salvar (novo) → tela de sucesso curta com **Convidar o Gestor** e **Abrir a empresa**.
- Sair com alterações não salvas pede confirmação.

### 5.3. Dados da empresa — diálogo na sidebar

Aberto pelo nome da empresa no bloco de contexto da sidebar. Texto formatado, em blocos compactos: identificação, endereço, contato, status, consultoria que atende e responsável técnico. Consultoria: + grupo, código interno, observações e **Editar**. Fonte: `GET /companies/:id` com a projeção do D14.

---

## 6. Passos

### Fase 0 — Storage

- [x] **0.1** `StorageService` (interface) + `MemoryStorage` + `FirebaseStorage` (`firebase-admin`), escolhidos por `STORAGE_DRIVER` (D22). Validação de ambiente no boot.
- [x] **0.2** Model `FileAsset` (doc 04 §8) com migration.
- [x] **0.3** Testes: tipo pelo conteúdo, limite de tamanho, SVG recusado, caminho sempre prefixado pelo `accountId`, URL assinada expira.

> **Estado: verde.** Storage atrás de `StorageDriver`, com `LocalStorage` (disco, padrão) e `FirebaseStorage`. O tipo do arquivo é lido dos bytes; SVG, HTML disfarçado e RIFF que não é WebP são recusados; chave com `../` é recusada.
>
> **Um defeito antigo apareceu aqui:** `prisma:migrate:test` trocava só a `DATABASE_URL`, mas as migrações usam `directUrl` (`DIRECT_URL`) — elas iam para o banco de **desenvolvimento**, e a branch de teste nunca recebia nenhuma. O script agora troca as duas e recusa rodar se a conexão direta de teste coincidir com a de desenvolvimento.

### Fase 1 — Contratos e modelagem

- [x] **1.1** Migration de `Company`: campos do doc 04 §2 em colunas planas (D16); `isActive` → `deactivatedAt` + `deactivatedByUserId`, migrando `false` para `deactivatedAt = now()`; `groupId`, `logoFileId`; CNPJ existente reescrito só com dígitos.
- [x] **1.2** Model `CompanyGroup` com unicidade por nome normalizado na conta.
- [x] **1.3** `packages/shared/src/companies`: `CompanyStatus`, `deriveCompanyStatus`, `COMPANY_STATUS_LABEL`, `CompanyListItem`, `CompanyActions`, `CompanyDetail`, `CompanyProfile`, `CompanyUpsertRequest` (grupo **pelo nome**, D21), `CompanyListQuery`, `CompanyGroupOption`; `isValidCnpj`, `onlyDigits`, `formatCnpj`, `formatCep`, `normalizeForSearch`, `BRAZIL_STATES`.
- [x] **1.4** `CompanySummary.isActive` → `status` (D19), ajustando `auth.service.ts`, `team.service.ts` e os consumidores no front.
- [x] **1.5** Seed: BRF e Seara com endereço e contato completos, CNPJs com dígito verificador válido, BRF no "Grupo BRF". A **Seara não tem Gestor** no elenco, e por isso é a empresa em implantação — não foi preciso uma terceira.

> **Estado: verde.** A derivação do status mora num lugar só (`companies/company-status.ts`), e a sessão, a Equipe e a lista futura leem dela. Nenhum comportamento existente mudou: as 150 e2e passaram sem ajuste de regra — só os helpers de teste ganharam `dadosDeEmpresa()`, porque empresa agora exige endereço e contato.

### Fase 2 — Testes de backend (vermelhos primeiro)

- [x] **2.1** Criar: Josué e Carla criam; Técnico, cliente e Executor são recusados. Vínculos de quem criou + todos os `LEAD_ENGINEER` ativos (D10); Carla cria e **Fernando não** ganha vínculo.
- [x] **2.2** Validação: obrigatórios do D18; CNPJ inválido; CNPJ repetido na conta recusado, **em outra conta aceito**.
- [x] **2.3** Listar: cada um vê só a carteira; a Carla não vê empresa criada pelo Josué fora da carteira dela.
- [x] **2.4** Busca: acento, maiúscula, CNPJ com e sem máscara, nome do Gestor, cidade; **observações não entram**.
- [x] **2.5** Status derivado: sem Gestor → `IMPLANTATION`; Gestor convidado → `AWAITING_MANAGER`; **convite expirado → volta a `IMPLANTATION`**; aceito → `ACTIVE`; desativada → `INACTIVE`.
- [x] **2.6** Detalhe: o Marcos recebe `CompanyProfile` **sem** grupo, código e observações; Seara pelo Marcos → 404 (D13).
- [x] **2.7** Editar, desativar, reativar: alçada e escopo; reativar sem Gestor → `IMPLANTATION`.
- [x] **2.8** Modo leitura: convite e troca de vínculo em empresa inativa são recusados com mensagem de negócio; leitura continua.
- [x] **2.9** Grupos: lista recortada pela carteira; nome existente fora da carteira é reaproveitado sem aparecer na lista (D21).
- [x] **2.10** Logo: upload da consultoria aceito; do cliente recusado; arquivo de outra conta nunca é alcançável.
- [x] **2.11** `actions` concorda com a mutação: o que vier `false` é recusado pelo endpoint (mesmo teste de concordância do 2.9 da Equipe).

> **Estado: vermelho, como deve ser.** 54 testes de regra (`companies.e2e-spec.ts`) e 16 de transporte (`companies-http.e2e-spec.ts`) contra esqueletos que só lançam. Dois passaram na primeira execução: o do status na sessão, que a Fase 1 já entregou, e o de "404 para empresa de outra conta" — que passava porque **a rota não existia**, e rota inexistente também é 404. Foi apertado: agora exige 200 na própria empresa antes de exigir 404 na alheia.

### Fase 3 — Implementação do backend

- [x] **3.1** `CompaniesModule`: `GET /companies`, `GET /companies/:id`, `POST /companies`, `PATCH /companies/:id`, `POST /companies/:id/deactivate`, `POST /companies/:id/reactivate`.
- [x] **3.2** `PUT /companies/:id/logo` (multipart) e `DELETE /companies/:id/logo`; URL assinada no detalhe.
- [x] **3.3** `GET /company-groups?q=`.
- [x] **3.4** `CompanyStatusService` — a derivação num lugar só, usada pela lista, pelo detalhe e pela sessão.
- [x] **3.5** Trava de modo leitura (D11) aplicada às mutações que já existem (convites, vínculos).
- [x] **3.6** Auditoria: criar, editar (com antes/depois), desativar, reativar, trocar logo.
- [x] **3.7** Colunas futuras devolvidas como `0` / ausente (D5), com um único ponto a trocar quando equipamentos existirem.

> **Estado: verde.** 70 testes novos; nenhum teste de regra precisou ceder. Dois foram corrigidos por erro **do teste**: guardavam o escopo de antes do cadastro e o reusavam depois — numa requisição de verdade o escopo é remontado a cada chamada.
>
> **Uma regra apareceu ao implementar:** numa conta recém-aberta, o Engenheiro Responsável ainda não tem vínculo nenhum — e como o papel mora no vínculo, ele não poderia cadastrar a primeira empresa. O **titular da conta** sempre pode cadastrar, e entra como Engenheiro Responsável. Está em `papelParaCadastrar`.
>
> **Instabilidade vista uma vez, sem causa confirmada:** um `socket hang up` no primeiro teste da casca HTTP, rodando logo depois da suíte de regras. Não se repetiu em três execuções seguidas. Se voltar, é por onde começar.

### Fase 4 — Testes de frontend (vermelhos primeiro)

- [x] **4.1** Lista: três estados; carteira vazia × busca sem resultado; "—" em % e Última análise; Técnico sem botão de nova empresa; busca e filtro refletidos na URL.
- [x] **4.2** Formulário: obrigatórios; CNPJ inválido ao lado do campo; CNPJ duplicado vindo do servidor no campo; modo editar carrega os dados.
- [x] **4.3** Buscas externas: preenche só campos vazios; falha mostra aviso e mantém campos editáveis.
- [x] **4.4** Grupo: escolher existente e criar novo.
- [x] **4.5** Diálogo da sidebar: cliente sem campos internos e sem Editar; consultoria com os dois.

### Fase 5 — Implementação do frontend

- [x] **5.1** `CompaniesService` em `features/app/companies/services/`.
- [x] **5.2** Services externos isolados (D25).
- [x] **5.3** Lista em `app-data-table`, com menu de ações e confirmação de desativar.
- [x] **5.4** Formulário (reactive forms tipado) em `features/app/companies/company-form/`, com as rotas do D2.
- [x] **5.5** Upload de logo com pré-visualização.
- [x] **5.6** Diálogo de dados da empresa na sidebar.
- [x] **5.7** Remover o aviso de tela provisória e a leitura da carteira pela sessão.

> **Estado: verde.** 46 testes novos no front (lista, formulário, diálogo e as duas consultas externas). Dois defeitos apareceram, nenhum de produção: um teste criava dois `RouterTestingHarness`, e o jsdom não tem `scrollIntoView`, que o `p-select` chama ao reabrir com valor escolhido — polyfill em `test-setup.ts`, ao lado do `matchMedia`.
>
> **Decisões de forma tomadas na implementação:**
> - A lista de papéis que administram empresa mora em `COMPANY_ADMIN_ROLES` (`@normatiza/shared`): servidor, guarda de rota e botão leem a mesma.
> - A rota de cadastro usa `companyAdminGuard`, e não `roleGuard`: o titular sem vínculo não tem papel para mostrar, e é ele quem cadastra a primeira empresa.
> - Depois de salvar, a sessão é recarregada (`auth.refresh()`): sem isso a empresa nova não passaria na guarda do Contexto 2, e um nome editado seguiria velho na sidebar.
> - "Convidar o Gestor" leva à Equipe da Empresa, onde o convite já existe com a empresa fixa — em vez de um segundo formulário de convite.
> - Validado contra a API real com o seed: carteira por pessoa, projeção do cliente sem anotações, busca por cidade/grupo/CNPJ parcial/Gestor, e 403 ao Técnico.
>
> **Lacuna conhecida, fora desta feature:** o titular de uma conta recém-aberta, sem vínculo nenhum, passa na guarda de cadastro, mas a porta de entrada (`rotaDeEntrada`) e a guarda da lista (`CONTEXTO_1`) ainda o recusam. Entra com o fluxo de criação de conta do Contexto 0, que não existe.

### Rodada de ajustes após o primeiro uso (2026-09-23)

Quatro defeitos achados no uso, cada um com teste antes da correção:

- [x] **Menu da empresa sobre o formulário.** O menu reconhecia o Contexto 2 por `/app/empresas/:algo`, e lia `new` e `edit` como id de empresa. Desvio explícito em `MenuContextService`.
- [x] **A tela inteira subia no fim da rolagem, sidebar junto.** O `<input type="file">` do logo usava `sr-only` (`position: absolute`) sem ancestral posicionado: posicionava-se contra a página e a esticava além da tela, e o `body` passava a rolar. Agora vive dentro de um contêiner `relative`.
- [x] **Enter salvava o formulário.** Não há mais `ngSubmit` nem botão de envio, e `semEnter` barra o envio implícito — a área de texto segue quebrando linha.
- [x] **CEP sem indicação de busca, e trocar o CEP só trocava a rua.** A regra "só ocupa campo vazio" valia para o CEP também, e estava errada para ele: **o endereço é do CEP** ([03 §3.2](../produto/03_navegacao_e_telas.md)). Com indicador de busca, e sem consultar de novo quando o CEP não mudou.

Quatro melhorias:

- [x] **Formulário em etapas** (`p-stepper`): Identificação (com o logo) → Endereço → Contato → Organização interna, um bloco por vez, rodapé de ações fixo, conteúdo centralizado, sem subtítulo por bloco. Avançar valida a etapa; na edição, qualquer etapa é um clique.
- [x] **Campos mais próximos.** A linha reservada ao erro caiu de um parágrafo para uma linha de texto pequeno.
- [x] **Ações de linha como ícones com nome** — `app-row-action`, aplicado às quatro tabelas (Empresas, Equipe, Equipe da Empresa, Admins). Padrão em [design_system.md §6](../web/design_system.md), incluindo quando usar switch.
- [x] **Ver dados da empresa pela lista** — o olho abre o mesmo diálogo da sidebar, para todos que veem a carteira.

> **Dois defeitos meus na própria correção**, pegos pelos testes: ao trocar de etapa, o campo de CNPJ se reconecta e revalida, e isso apagava a recusa do servidor posta com `setErrors` — ela passou a um sinal preso ao número recusado. E o aviso de falha da busca por CNPJ tinha ficado na etapa de endereço.

### Fase 6 — Fechamento

- [ ] **6.1** Roteiro de aceite por pessoa do elenco: Josué cria a JBS (nasce em implantação, entra na carteira dele); Carla cria uma empresa e ela aparece para Josué, não para Fernando; Josué convida Gestor → aguardando; Gestor aceita → ativa; Marcos abre o diálogo e não vê observações; Josué desativa a Seara → convite na Seara é recusado.
- [ ] **6.2** Dark mode, telas estreitas e teclado no formulário.
- [ ] **6.3** Configurar o Firebase de verdade (variáveis no `.env` e no deploy) e conferir upload e leitura assinada.
- [ ] **6.4** Apagar este plano.

---

### Segunda rodada (2026-09-23)

- **Grupo empresarial:** o `datalist` nativo só buscava depois de digitar, não abria no foco e o navegador não reabre a lista quando as opções chegam depois. Trocado por `p-autocomplete` com texto livre; os grupos da carteira vêm uma vez ao abrir o formulário e o filtro é local (sem acento e caixa).
- **Ícones cortados nas tabelas:** o botão do PrimeNG e o `ng-icon` têm `overflow: hidden`, e item flexível assim encolhe até zero — a coluna de ações era espremida. `flex: none` em `app-row-action` resolve em todas as tabelas.

## 7. Riscos

- **Troca de `isActive` por `status` na sessão** atravessa auth, Equipe e sidebar. Fazer na Fase 1, com a suíte inteira verde antes de seguir.
- **BrasilAPI** tem limite de requisições por IP. Buscar só quando o CNPJ estiver completo e válido, nunca a cada tecla.
