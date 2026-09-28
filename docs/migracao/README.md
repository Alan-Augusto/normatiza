# 🔁 Migração de Dados — Legado → Normatiza v2

Como cada tabela e coluna do sistema legado vira dado no modelo novo. **O documento cresce junto com a aplicação:** toda feature que cria ou muda uma entidade com origem no legado atualiza a seção dela aqui, no mesmo trabalho.

> **O que vale onde.**
> - As **regras de produto** que a migração obedece (HRN reproduzível, identificador de origem, análise congelada, senha sem redefinição) estão em [05 — Regras Transversais §6](../produto/05_regras_transversais.md). Este documento não as repete, aplica.
> - O **legado como ele é** está em [`docs/legado/`](../legado/README.md), que é congelado. Onde aquele acervo erra, a correção fica em [§2](#2-onde-o-acervo-legado-erra), conferida no código-fonte.
> - O **modelo de destino** é o de [04 — Modelo de Dados](../produto/04_modelo_de_dados.md) e, quando já existe, o `schema.prisma`.
>
> **Fontes do legado:** `normatiza/api-normatiza` (.NET, EF Core, `Updates/*.sql`) e `normatiza/front-normatiza` (React). O migrador ainda não existe.

---

## 1. Visão geral

### Situação por entidade

**Destino implementado** quer dizer que a tabela nova já existe no `schema.prisma`. **Modelado** quer dizer que ela só existe em [04](../produto/04_modelo_de_dados.md).

| Legado | Destino na v2 | Destino | Mapeamento |
| :--- | :--- | :--- | :--- |
| `user` tipo `Engineer` | `Account` + `User` dono + `Membership` `LEAD_ENGINEER` | implementado | §3.1, com pendências |
| `user` tipos `Analyst`, `GuestEngineer`, `Manager` | `User` + `Membership` | implementado | §3.1, com pendências |
| `user` tipo `Customer` | `Company` + `User` com papel `DIRECTOR` | implementado | §3.2, com pendências |
| `user` tipo `Admin` | `PlatformAdmin` | implementado | pendente |
| tabelas N:N `*_customer`, `*_enginner` | `Membership` | implementado | §3.1 |
| `sector` | `Sector` | modelado | §4 |
| `machine` | `Equipment` + `Analysis.technicalSheet` | modelado | §5 |
| `photo` | `FileAsset` | implementado (sem `equipmentId`) | §6 |
| `analysis`, `risk`, `pap`, `pe` e N:N | `Analysis`, `RiskPoint`, `PapAssessment`, `PeAssessment` | modelado | pendente |
| `danger_*`, `security*`, `standard*` | catálogos globais ([04 §7](../produto/04_modelo_de_dados.md)) | modelado | pendente |
| `studies` | `SafetyStudy` | modelado | pendente |
| `technicalReport` | `Report` | modelado | pendente, e texto a interpretar (§2) |
| `userDocs` | `FileAsset` da empresa | implementado | pendente |
| `password_recovery`, `email_confirmation` | — | não migram | tokens temporários |

### A base, em números

Medido na base de produção do legado em 2026-09-24, só com consultas de leitura.

| | Total | Observação |
| :--- | --: | :--- |
| Engenheiros (`Engineer`) → contas | 210 | 44 desativados, 180 trial, **114 sem nenhum cliente** (§3.1) |
| Empresas (`Customer`) | 323 | Todas ativas; **20 CNPJs repetidos no mesmo engenheiro**, somando 61 empresas (§3.2) |
| Gestores (`Manager`) | 546 | 514 vinculados a empresas; **122 em mais de uma** (§3.1) |
| Técnicos (`Analyst`) | 23 | |
| Engenheiros convidados (`GuestEngineer`) | 7 | |
| Admins | 2 | Nenhum pendurado em engenheiro |
| Máquinas | 28.743 | **Exatamente o número de análises**: a relação 1:1 se confirma |
| Setores com nome repetido na empresa | 14 nomes, 29 setores | Diferença só de maiúscula ou espaço |

O perfil da base é **agroindustrial**: as utilizações mais comuns são esteira transportadora, climatização de aviário, rosca transportadora, bombeamento, incubação de ovos e desossa.

### Ordem de carga

As chaves estrangeiras obrigam esta ordem:

1. Contas e usuários.
2. Empresas.
3. Vínculos.
4. Setores.
5. Equipamentos.
6. Arquivos.
7. Análises e seus filhos.
8. Laudos.

Os catálogos globais entram antes de tudo.

### Identificador de origem

A regra está em 05 §6. **O formato ainda não foi decidido.** Nenhuma tabela da v2 tem coluna para isso ainda. As duas saídas:

- **Coluna `legacyId` em cada tabela migrada.**
  - A favor: consulta direta e índice simples.
  - Contra: suja o schema de tabelas que só têm origem legada em parte dos registros.
- **Tabela única `legacy_refs (entity, legacyId, newId)`.**
  - A favor: o schema fica limpo, e ela serve também às origens que não têm tabela própria.
  - Exemplo: uma linha de `machine` vira **dois** registros, um `Equipment` e uma `TechnicalSheet`.
  - Contra: exige um join a mais para rastrear.

Recomendação: a tabela única. O caso de `machine` mostra que "uma linha de origem → um registro de destino" não se sustenta.

---

## 2. Onde o acervo legado erra

Conferido no código-fonte do legado. Quando `docs/legado` e o código divergem, **vale o código**, porque é ele que produziu os dados.

| `docs/legado` diz | O código faz | Efeito na migração |
| :--- | :--- | :--- |
| `machine`: as colunas booleanas, `totalOperators` e `createdAt` aceitam nulo | São `NOT NULL` | Nenhum tratamento de nulo nessas colunas |
| `capitation` é "captação" (de resíduos ou gases), uma fonte de energia | É a pergunta sobre **capacitação** dos trabalhadores, a 6ª das "disposições finais" | Vai para `safetyManagement.workersTrained`, e não para fontes de energia |
| A 4ª foto (`topPhoto`) é a vista superior | A tela a rotula **"Posterior"** | Vai para `recognitionPhotos.rear` |
| As 4 fotos são obrigatórias | Nada exige; só o setor é obrigatório | Espere análises com 0 a 4 fotos |
| A análise seleciona uma máquina já existente no inventário | **Toda análise cria uma máquina nova**; não há como escolher uma existente | A mesma máquina física aparece repetida (§5.3) |
| O laudo técnico reúne vários equipamentos | É o **upload de um PDF por análise** | `technicalReport` → `Report` 1:1 |
| `photo.path` é uma URL pública | É o **caminho no Firebase Storage** | É a `storageKey`, e não um link |
| Existe o nível `customer_branch` (unidade/filial) | Foi **removido na v1.4.0**; o setor pende direto do cliente | Não há unidade a migrar |

A empresa da máquina, lida pelo setor, bate com a da análise em 28.742 das 28.743 linhas. A única divergente entra no relatório. Nas demais, `sector.customerId` e `analysis.customerId` dizem a mesma coisa.

Sinal de alerta: `Controllers/Analitics.cs` tem marcadores de conflito de merge não resolvidos (`<<<<<<< HEAD`). O que está em produção pode divergir do fonte. Antes de confiar numa regra de cálculo lida ali, confirme contra os dados.

---

## 3. Contas, pessoas e empresas

### 3.1. Usuários e papéis

| Legado (`user.type`) | v2 |
| :--- | :--- |
| `1` `Admin` | Admin do Sistema (`PlatformAdmin`) |
| `2` `Engineer` | Dono de uma `Account` e Engenheiro Responsável (`LEAD_ENGINEER`) em todas as empresas dela |
| `3` `Analyst` | Técnico (`TECHNICIAN`) |
| `4` `Customer` | Empresa **e** Diretor (§3.2) |
| `5` `Manager` | Gestor (`MANAGER`) |
| `6` `GuestEngineer` | Engenheiro da Consultoria (`CONSULTANT_ENGINEER`) |

Os papéis **Engenheiro do Cliente** e **Executor** não têm origem no legado: nascem vazios.

**A conta vem do engenheiro.** Cada `Engineer` vira uma `Account`:

- `Account.name` recebe `user.businessName`, ou `user.name` quando não há nome fantasia.
- `Account.document` recebe `user.cpfCnpj`.
- Todo usuário com `engineerId` apontando para ele entra nessa conta.

**Os vínculos vêm das tabelas N:N:**

| Legado | v2 |
| :--- | :--- |
| `analyst_customer` | `Membership` `TECHNICIAN` por empresa |
| `guestengineer_customer` | `Membership` `CONSULTANT_ENGINEER` por empresa |
| `manager_customer` | `Membership` `MANAGER` por empresa |
| `analyst_enginner`, `manager_enginner` | Só confirmam a conta; não geram vínculo |

**Colunas de `user` → `User`:**

| Legado | v2 | Transformação |
| :--- | :--- | :--- |
| `name` | `name` | — |
| `email` | `email` | Minúsculas e sem espaços. Único **por conta**; no legado era único no banco todo |
| `cellphone`, `telephone` | `phone` | O celular tem precedência |
| `proRegisterType` | `registryType` | `CREA`/`CFT`; outro valor fica nulo e entra no relatório |
| `proRegisterNumber` | `registryNumber` | — |
| `role` | `jobTitle` | — |
| `password` + `salt` | `passwordHash` + `legacyPasswordSalt`, `passwordAlgo = LEGACY_SHA256` | Base64. Reescrito em Argon2id no primeiro login |
| `emailConfirmed` | `emailConfirmedAt` | O legado não guarda a data: usa-se a data da migração |
| `enabled`, `disabledAt` | `status`, `disabledAt` | `disabledAt` preenchido ou `enabled = false` → `DISABLED`; senão `ACTIVE` |
| `createdAt` | `createdAt` | — |
| `engineerId` | `invitedByUserId` | A árvore de convites começa no engenheiro |

**Pendências:**

- **Gestor em mais de uma empresa: bloqueia a migração de 122 pessoas.** No legado, `manager_customer` permite um `Manager` em vários clientes. Na v2, papel do lado cliente vale para uma empresa só ([01 §5](../produto/01_papeis_e_permissoes.md)). Distribuição:
  - 392 Gestores em 1 empresa;
  - 52 em 2 e 26 em 3;
  - 44 em 4 a 11;
  - 11 em 16 a 46.

  Nenhum atravessa engenheiros. Pela raiz do CNPJ:
  - 82 Gestores têm só matriz e filiais de uma mesma pessoa jurídica;
  - 20 têm raízes em parte repetidas;
  - 19 têm raízes todas diferentes.

  A decisão é de produto e está em [06 — Pendências §6](../produto/06_pendencias.md).
- **Contas sem uso.** Dos 210 engenheiros:
  - 114 nunca cadastraram um cliente;
  - 180 são trial;
  - 2 documentos se repetem entre engenheiros, e `Account.document` é único na v2.

  Proposta: migrar só as contas com ao menos um cliente. As demais ficam fora e são listadas no relatório, com o e-mail do dono, para contato comercial.

  **Os documentos repetidos:**
  - Um é de dois trials sem cliente (engenheiros 85 e 88), que ficam fora pela regra acima.
  - O outro é o **mesmo CPF em três engenheiros com clientes**:
    - o 5, com 209 clientes, que é o grosso da base;
    - o 2, com 3 clientes;
    - o 73, com 5 clientes.

    Esse CPF aparece também como documento de empresas cliente dos engenheiros 2 e 73. Parece a mesma pessoa, com contas de teste ou demonstração. Falta confirmar antes de decidir entre unir as três contas, migrar só a 5, ou dar um documento diferente às outras duas.
- **Gestores sem empresa.** 32 dos 546 não estão em `manager_customer`. Falta decidir se entram na conta sem vínculo ou se ficam de fora.
- **O Admin.** São 2 admins. `User` exige `accountId`, e o Admin do legado não pertence a engenheiro nenhum. É preciso decidir em qual conta ele mora.
- **Sem destino ainda:** `maxAnalysis`, `isTrialUser`, `avaliableTrialAnalisys`, `avaliableTrialDays` e `expiredAt` esperam o faturamento; `useDocx`, `reportType` e `canDeleteAnalisys` esperam a personalização de laudos e a exclusão de análise; `photoId` (foto de perfil) não existe no `User` novo.

### 3.2. O `Customer` vira empresa e pessoa

No legado, o `Customer` é ao mesmo tempo o login de leitura e o cadastro da indústria. Na v2 isso se separa:

- os dados da indústria viram uma `Company`;
- o login vira um `User` com `Membership` `DIRECTOR` nessa empresa.

| Legado (`user`) | v2 (`Company`) | Transformação |
| :--- | :--- | :--- |
| `name` | `corporateName` | Razão social |
| `businessName` | `tradeName` | Vazio → `name` |
| `cpfCnpj` | `document` | Só dígitos |
| `customerCode` | `externalCode` | Guardado também porque compõe os códigos antigos de análise (§5.4) |
| `responsible` | `contactName` | Vazio → `name` |
| `role` | `contactRole` | — |
| `email` | `contactEmail` | — |
| `telephone` | `contactPhone` | — |
| `cellphone` | `contactMobile` | — |
| `postalCode`, `streetName`, `streetNumber`, `complement`, `district`, `city`, `state` | `zipCode`, `street`, `addressNumber`, `complement`, `district`, `city`, `state` | — |
| `disabledAt` | `deactivatedAt` | Empresa inativa, em modo leitura |
| `engineerId` | `accountId` | A conta do engenheiro |
| — | `slug` | Gerado pela regra de [03 §4](../produto/03_navegacao_e_telas.md), a partir do `tradeName` já migrado. As unidades de mesmo nome fantasia (§3.2, CNPJ repetido) caem no desempate por cidade e número. **Ordem de geração: `createdAt` do cliente**, para que a unidade mais antiga fique com o slug sem sufixo |

**O status da empresa não se migra: ele é calculado.** Com o Gestor vindo de `manager_customer`, a empresa nasce *ativa* quando há um Gestor e *em implantação* quando não há.

**Pendências:**

- **CPF no lugar de CNPJ.** Das 323 empresas:
  - 275 têm CNPJ;
  - **22 têm CPF**;
  - 8 têm um valor de outro tamanho;
  - 18 têm o documento vazio.

  Aceitar ou não CPF é a decisão de [06 — Pendências §7](../produto/06_pendencias.md). Os 26 que não são nem CPF nem CNPJ entram no relatório.
- **CNPJ repetido na mesma conta: 20 documentos, 61 empresas.** A v2 recusa (`@@unique([accountId, document])`).
  - Não são cadastros abandonados nem duplicados. São **unidades operacionais** (área da planta, unidade produtiva numerada, bloco), com análise em períodos que se sobrepõem.
  - Três repetições são CPFs em contas de teste (§3.1), com 0 a 9 análises.
  - A saída depende de o que é uma empresa na v2: [06 — Pendências §8](../produto/06_pendencias.md). Se a empresa for a unidade, cada cliente legado vira uma `Company`, como está, e o CNPJ deixa de ser único.
- **`customerCode` não é único.** Oito clientes de um mesmo CNPJ compartilham o código `YPEAMP`, e o sequencial da análise é por cliente. Logo, o código de exibição `AR-{customerCode}-{sequencial}` **se repete entre clientes**. A referência de origem da análise (§5.4) precisa do id do cliente junto; o código `AR-…` sozinho não identifica.
- **Endereço quase sempre completo.** No máximo 3 empresas têm algum campo de endereço vazio. Elas migram sem validar e são sinalizadas no relatório para completar o cadastro.
- **Contato técnico.** 172 das 323 empresas não têm `responsible`. O `contactName` recebe o `name`, como na tabela acima, e o e-mail de login vira o `contactEmail`.
- **O login do `Customer`.** O e-mail costuma ser da empresa, não de uma pessoa. Fica decidir se ele vira mesmo um `User` Diretor ou só o contato técnico da `Company`.
- **Grupo empresarial.** Não tem origem no legado: nasce vazio.

---

## 4. Setores

**Origem:** `sector` (`id`, `name`, `customerId`). **Destino:** `Sector` ([04 §2](../produto/04_modelo_de_dados.md)), que ainda não está no `schema.prisma`.

| Legado | v2 | Transformação |
| :--- | :--- | :--- |
| `name` | `name` | Sem espaços nas pontas |
| — | `normalizedName` | `normalizeForSearch(name)`, o mesmo do cadastro: é por ele que os duplicados se juntam |
| `customerId` | `companyId` | A `Company` que veio desse `Customer` |
| — | `description`, `responsibleUserId` | Nascem vazios |

**Duplicados.** No legado, o setor era criado dentro do formulário da análise e nunca podia ser editado nem excluído, então há repetições por acento, maiúscula e espaço ("Usinagem", "usinagem ", "Usinágem"). Dentro de uma mesma empresa, setores com o mesmo nome normalizado (`normalizeForSearch` de `@normatiza/shared`) viram **um só**. Todos os `id` de origem apontam para ele. Grafias diferentes que o normalizador não junta ficam separadas e entram no relatório.

---

## 5. Equipamentos

**Origem:** `machine`. **Destino:** `Equipment` (a identidade do ativo) e `Analysis.technicalSheet` (a fotografia da vistoria), conforme [04 §3 e §4](../produto/04_modelo_de_dados.md). Nenhum dos dois está no `schema.prisma` ainda.

### 5.1. A virada: de linha da análise para ativo

No legado, `machine` não é um inventário. **Cada análise cria a sua máquina**, na relação 1:1, e a mesma prensa vistoriada em 2022 e em 2024 são duas linhas. A empresa da máquina só é alcançável pelo setor (`machine.sectorId → sector.customerId`) ou pela análise (`analysis.customerId`).

A migração de uma linha de `machine` produz:

- **um `Equipment`**, com os campos de identidade. Juntar linhas no mesmo equipamento é exceção, feita à mão (§5.3);
- **a `TechnicalSheet` da análise dona dela**, com os campos da vistoria e uma cópia da identidade em `identity`.

Quando duas linhas são juntadas, **a identidade vem da análise mais recente**. A ficha de cada análise guarda a identidade como ela estava naquela vistoria.

### 5.2. Colunas

**Identidade → `Equipment`** (e a cópia em `TechnicalSheet.identity`):

| Legado | v2 | Transformação |
| :--- | :--- | :--- |
| `equipmentName` | `name` | Vazio → "Máquina sem nome", e entra no relatório |
| `equipmentType` | `machineTypeId` | Texto livre no legado, catálogo na v2: cada texto distinto (normalizado) vira um `MachineType` da conta, salvo o que casar com um tipo global. A lista de-para sai no relatório, para a consultoria fundir sinônimos ("Esteira", "Esteira transportadora") |
| `equipmentModel` | `model` | — |
| `manufacturer` | `manufacturerName` | — |
| `serialNumber` | `serialNumber` | — |
| `manufactureYear` | `manufactureYear` | Fora de 1900 até o ano corrente → nulo, e entra no relatório |
| `manufacturerTag` | `tag` | **Não é do fabricante, apesar do nome:** é a TAG do cliente. TAG repetida na mesma empresa (§5.3) |
| `manufacturerPatrimony` | `patrimonyCode` | Idem: patrimônio do cliente |
| `sectorId` | `sectorId` | O setor unificado (§4) |
| `frontPhotoId` | `mainPhotoFileId` | Quando não houver, a primeira que existir entre a esquerda, a direita e a posterior |
| `createdAt` | `createdAt` | Quando linhas são juntadas, o da mais antiga |
| — | `code` | `EQ-0001` em diante, por empresa, na ordem de `createdAt` da máquina. O código do inventário legado (`{customerCode}-{sequencial}`) não é reaproveitado, porque é o sequencial da análise (§5.4) |

**Vistoria → `TechnicalSheet`:**

| Legado | v2 | Transformação |
| :--- | :--- | :--- |
| `manufacturerCnpj`, `manufacturerCrea` | `manufacturer.document`, `manufacturer.registry` | Só dígitos no CNPJ, sem validar o dígito verificador (o legado não validava) |
| `manufacturerAddress`, `manufacturerCity`, `manufacturerPostalCode` | `manufacturer.address`, `.city`, `.zipCode` | — |
| `height`, `width`, `depth`, `weight` | `dimensions.heightMm`, `.widthMm`, `.depthMm`, `.weightKg` | **Texto livre sem unidade no legado.** Converter só o que der para ler com segurança; ver pendência |
| `capacity` | `production.powerKw` ou `production.capacity` | A tela chama de "Capacidade", e o conteúdo mistura potência e capacidade. Ver pendência |
| `productiveCapacity` | `production.capacity` | — |
| `cycleTime`, `driveTime`, `emergencyTime` | `production.cycleTimeSec`, `.activationTimeSec`, `.emergencyStopTimeSec` | Texto livre; mesmo tratamento das dimensões |
| `commandPositions` | `operation.controlStations` | Texto no legado, número na v2 |
| `totalOperators` | `operation.exposedOperators` | — |
| `machineUsage` | `operation.purpose` | **Não é regime de turnos:** é para que a máquina serve ("Esteira transportadora", "Bombeamento de água", "Incubar ovos de aves"), conforme a base real |
| `processDescription` | `operation.processDescription` | — |
| `operatorInterventions` | `operation.commonInterventions` | — |
| `otherInfo` | `operation.otherInfo` | — |
| `eletricEnergy`, `pneumaticEnergy`, `hydraulicEnergy`, `mechanicalEnergy`, `radioactiveEnergy` | `energySources.electric`, `.pneumatic`, `.hydraulic`, `.mechanical`, `.radioactive` | — |
| `intendedPreventiveMaintenance` | `safetyManagement.maintenancePlannedByQualifiedProfessional` | Pergunta 1 de [03 §5.2](../produto/03_navegacao_e_telas.md) |
| `registeredPreventiveMaintenance` | `safetyManagement.maintenanceRecorded` | Pergunta 2 |
| `maintenanceRecordAvailable` | `safetyManagement.maintenanceRecordsAvailable` | Pergunta 3 |
| `hasInstructionManual` | `safetyManagement.hasInstructionManual` | Pergunta 4 |
| `workingAndSafetyProcedures` | `safetyManagement.hasWorkAndSafetyProcedures` | Pergunta 5 |
| `capitation` | `safetyManagement.workersTrained` | Pergunta 6: é **capacitação**, não captação (§2) |
| `frontPhotoId`, `leftPhotoId`, `rightPhotoId`, `topPhotoId` | `recognitionPhotos.front`, `.leftSide`, `.rightSide`, `.rear` | `topPhotoId` é a **posterior** (§2) |

**Filhos de `machine`.** `risk`, `pap` e `pe` pendem de `machineId`, mas na v2 pertencem à análise. Como a relação no legado é 1:1, a análise dona de cada máquina é a dona dos filhos dela.

### 5.3. Mesma máquina, várias linhas

**Cada linha de `machine` vira um equipamento. Não há junção automática.** A suposição de partida era que as revistorias multiplicavam as máquinas. Os dados mostram outra coisa: quase todo "duplicado" é uma **máquina diferente e idêntica**, como as 10 esteiras iguais do mesmo aviário.

| Sinal | Medido | Leitura |
| :--- | :--- | :--- |
| Mesmo número de série na empresa | 227 grupos, 717 linhas, maior grupo com 66 | A série não identifica nada. Os campeões são "871639" (66), "NA" (34), "76470" (26). Aparecem ainda "ESTEIRA TRANSPORTADORA", "BRF", "01" e números de OS ("OS 14070087", "132/2024"): o campo foi usado para lote, ordem de serviço e até para o nome |
| Mesma TAG na empresa | 257 grupos, 528 linhas, maior grupo com 9 | Mais confiável, mas também com marcadores ("-", "N/A") |
| Mesmo nome e modelo no mesmo setor | 268 grupos, 651 linhas | **Só 25 grupos atravessam anos diferentes.** O resto foi cadastrado no mesmo ano, o que indica máquinas distintas, e não revistoria |

Juntar errado mistura o histórico de duas máquinas e produz um laudo falso. Não juntar só deixa um duplicado visível, que a consultoria pode resolver depois. Por isso a regra é:

- **Nenhuma junção automática**, nem por série, nem por TAG.
- **Relatório de candidatos à junção**, por empresa: mesma TAG (sem marcadores), ou mesmo nome e modelo no mesmo setor **em anos diferentes**. São algumas centenas de linhas, que dá para revisar à mão, com a consultoria dona da conta.

**Marcadores de vazio.** Série, TAG e patrimônio iguais a `-`, `N/A`, `NA`, `S/N`, `SEM`, `NAO`, `NÃO` ou `XX` migram como nulos. O texto original fica na cópia da identidade na ficha técnica.

**TAG repetida na mesma empresa.** Na v2 a TAG é única por empresa quando preenchida ([04 §3](../produto/04_modelo_de_dados.md)). Sem junção automática, a TAG repetida sobra. Ela fica no equipamento mais recente e sai dos demais, que entram no relatório. O valor original não se perde: continua na ficha técnica de cada análise. Juntar à mão os candidatos devolve a TAG ao equipamento unificado.

### 5.4. Códigos de exibição

O legado não grava código nenhum; calcula na hora:

- Análise: `AR-{customerCode}-{sequential com 7 dígitos}-{equipmentName}`.
- "ID da máquina" do inventário: `{customerCode}-{sequential}`. Apesar do nome, é o sequencial **da análise**, não da máquina.

Laudos emitidos e documentos citam esses códigos. A análise migrada guarda o código `AR-…` calculado, para que o cliente encontre a análise que o PDF antigo cita. **Esse código não é único** (§3.2): serve para busca, não como chave. A chave de origem é o `analysis.id`. Isso depende da decisão de §1 (identificador de origem).

### 5.5. Pendências

- **Dimensões, tempos e capacidade em texto livre.** Amostrados na base, com os conversores a seguir. Em todos eles vale a mesma regra: **o que não se lê com segurança fica nulo, e o texto original vai para `operation.otherInfo`, prefixado pelo nome do campo, para não se perder.**
  - **Altura, largura, profundidade e peso.** Quase sempre vêm como número e unidade, com a caixa e o espaço variando: "120 Cm", "787mm", "1000 Kg", "4000Kg". Lê-se o número, com vírgula ou ponto decimal, e a unidade `mm`, `cm` ou `m` (convertida para mm) ou `kg` e `t` (convertida para kg). Número sem unidade não é convertido.
  - **Capacidade.** Mistura potência ("0,55 kW", "0,55KW") com capacidade produtiva ("10 t/h", "115200 ovos", "MIN 5,9 CX/MIN MAX 13CX/MIN", "50878 KCAL/H"). Unidade `kW` vai para `production.powerKw`; `CV` e `HP` são convertidos para kW. Todo o resto vai inteiro, como texto, para `production.capacity`, que já é texto na v2.
  - **Tempos de ciclo, acionamento e parada de emergência.** Quase nunca são preenchidos (o valor mais comum de ciclo aparece 8 vezes em 28.743), e o conteúdo é heterogêneo: "Imediato", "Contínuo", "10 a 15 rpm", "adhgdaha", "000000000000000000000000". Converte-se só número com unidade de tempo explícita ("15 segundos", "1,4 SEGUNDOS", "1s", "20 min"). "Imediato" e "Instantâneo" **não** viram zero: não são medição.
- **Situação do equipamento.** `complianceStatus`, `worstCurrentHrn`, `openPointsCount` e `lastAnalysisAt` são calculados a partir das análises migradas, e não copiados. Sem plano de ação retroativo (05 §6), o equipamento migrado com risco acima do aceitável fica *não conforme*, sem tarefas.

---

## 6. Fotos e arquivos

**Origem:** `photo` (`id`, `path`). O `path` é o caminho no Firebase Storage:

`customer-{cid}/Analisys-Images/analise-{aid}/Machine-{mid}/machine_{front|left|right|top}/….jpg`

O front do legado já reduzia as fotos a no máximo 6000 px e as regravava em JPEG com qualidade 0,75.

**Destino:** `FileAsset` ([04 §8](../produto/04_modelo_de_dados.md)), com a `storageKey` sempre prefixada por `accounts/{accountId}/`. Hoje `FileAsset` tem `companyId`, mas **ainda não tem `equipmentId`**: a coluna nasce com o cadastro de equipamentos.

| Legado | v2 | Transformação |
| :--- | :--- | :--- |
| `path` | `storageKey` | Depende da pendência abaixo |
| — | `mimeType`, `sizeBytes` | Lidos do arquivo, nunca presumidos pela extensão |
| — | `visibility` | Fotos de vistoria: `CLIENT_VISIBLE`, porque o cliente já as via no laudo |
| — | `companyId`, `equipmentId` | Pela máquina dona da foto |
| — | `category` | Pela vista: frontal, esquerda, direita ou posterior |

**Pendência:** manter as referências originais ou copiar o acervo para `accounts/{accountId}/…`. Ver [06 — Pendências §5](../produto/06_pendencias.md). O prefixo por conta é regra da v2 e o caminho legado não o respeita, então manter as referências exige uma exceção explícita a essa regra.

---

## 7. Relatório da migração

Toda regra acima que diz "entra no relatório" alimenta **um relatório por conta**, entregue antes de a conta ser liberada. O relatório reúne:

- possíveis duplicados de equipamento;
- conflitos de série × TAG;
- TAGs retiradas;
- setores com grafias parecidas;
- empresas com cadastro incompleto;
- documentos que não são CNPJ;
- valores que não puderam ser convertidos.

É a lista do que alguém precisa olhar. Tudo que não está nela migrou sem perda.
