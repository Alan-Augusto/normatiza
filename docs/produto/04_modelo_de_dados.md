# 04 — Modelo de Dados

Entidades, relacionamentos e contratos que suportam o ciclo de adequação. As interfaces são descritas em TypeScript porque é assim que trafegam entre a API, o painel web e o app de campo — vivem em `packages/shared` e são consumidas pelos três.

**Convenções gerais:**
- Toda entidade de negócio carrega `accountId`. É o limite absoluto de isolamento, aplicado no servidor, nunca só na interface.
- Toda entidade carrega `createdAt`, `updatedAt` e `createdByUserId`. Omitidos abaixo por brevidade quando não são relevantes à regra.
- Nada é apagado fisicamente. Desativação usa `isActive` ou `disabledAt`. **A exceção é o que nunca produziu prova:** o equipamento sem análise e o setor sem equipamento podem ser excluídos — o cadastro feito errado não tem histórico a preservar (03 §4.2 e §4.3).
- Campos monetários em centavos (inteiro), nunca ponto flutuante.

---

## 1. Conta e identidade

```typescript
// A consultoria assinante. Unidade de faturamento e de isolamento.
interface Account {
  id: string;
  name: string;
  document: string;              // CNPJ/CPF da consultoria
  ownerUserId: string;           // o Engenheiro Responsável
  status: 'ACTIVE' | 'SUSPENDED';
}

// A pessoa. Um login, independente de quantos papéis tenha.
interface User {
  id: string;
  accountId: string;
  name: string;
  email: string;
  phone?: string;

  // Perfil profissional — apenas para engenheiros e técnicos
  registryType?: 'CREA' | 'CFT';
  registryNumber?: string;
  jobTitle?: string;

  invitedByUserId?: string;      // a aresta da árvore de convites
  status: 'INVITED' | 'ACTIVE' | 'DISABLED';
  disabledAt?: Date;
  succeededByUserId?: string;    // quem herdou seu escopo no desligamento
  lastAccessAt?: Date;
}
```

> `invitedByUserId` não determina propriedade de dados — tudo pertence a `accountId`. Ele existe para reconstruir a árvore, calcular o teto de escopo no convite e alimentar a tela de sucessão.

### O vínculo: onde mora a permissão

```typescript
// Papel **no vínculo** — sempre "…nesta empresa, desta conta".
type Role =
  | 'LEAD_ENGINEER'        // Engenheiro Responsável — consultoria
  | 'CONSULTANT_ENGINEER'  // Engenheiro da Consultoria
  | 'TECHNICIAN'           // Técnico
  | 'MANAGER'              // Gestor — cliente
  | 'CLIENT_ENGINEER'      // Engenheiro do Cliente
  | 'DIRECTOR'             // Diretor — leitura
  | 'EXECUTOR';            // Executor

type RoleSide = 'CONSULTANCY' | 'CLIENT' | 'EXTERNAL';

// O Admin do Sistema **não** é papel de vínculo: ele é a plataforma, tem escopo
// global e não pertence a empresa nenhuma. Vive numa dimensão própria,
// sobreposta ao login normal — quem é dono da plataforma e Engenheiro
// Responsável da própria consultoria tem **um** login só.
interface PlatformAdmin {
  id: string;
  userId: string;                // qualquer usuário, de qualquer conta
  grantedByUserId?: string;      // nulo só no primeiro, criado por linha de comando
  grantedAt: Date;
  revokedAt?: Date;              // revogar preserva o histórico; apagar o destruiria
}

// Um usuário × uma empresa × um ou mais papéis.
interface Membership {
  id: string;
  accountId: string;
  userId: string;
  companyId: string;
  roles: Role[];                 // acúmulo de papéis: a permissão efetiva é a união
  executorType?: 'INTERNAL' | 'THIRD_PARTY';
  supplierId?: string;           // quando executor terceiro
  isActive: boolean;
}
```

> **Por que `roles` é um array:** o Gestor e o Engenheiro do Cliente são a mesma pessoa em empresa pequena. Modelar um papel único forçaria duplicar o usuário ou criar um papel-exceção; o array resolve sem inventar caso especial no fluxo.
>
> **Por que o escopo vive no vínculo e não no usuário:** papéis da consultoria têm vários `Membership` (a carteira); papéis do cliente cujo escopo é a empresa têm exatamente um. A regra "carteira só do lado consultoria" é validada no servidor a partir do `RoleSide` do papel sendo concedido.

**Invariantes obrigatórias, validadas no servidor:**
1. Papéis cujo escopo **é a empresa** — `MANAGER`, `CLIENT_ENGINEER` e `DIRECTOR` — só podem existir em **um** `Membership` ativo por usuário. `EXECUTOR` é exceção: seu escopo são as próprias tarefas, não a empresa, e ele pode ter vários vínculos ativos dentro da mesma conta.
2. Toda empresa ativa tem ao menos um `Membership` ativo contendo `MANAGER` **de um usuário que aceitou o convite**. Não é uma checagem sobre um campo de status: é a própria definição de ativa (§2, `CompanyStatus`).
3. No convite, o conjunto de empresas oferecido é subconjunto do escopo de quem convida.
4. Todo `Membership` de um usuário pertence à mesma `Account` do `User` — o vínculo nunca atravessa contas.
5. `User.email` é único **dentro da conta**, não globalmente. É a consequência aritmética da invariante anterior: se a mesma pessoa tem um login por consultoria, o mesmo e-mail existe em duas contas.
6. Criar uma `Company` cria, na mesma transação, um `Membership` para quem a criou e um para cada usuário ativo da conta com `LEAD_ENGINEER`. Sem isso a empresa nasceria invisível — inclusive para o dono da conta, cujo escopo também é feito de vínculos.

> **A identidade pertence a uma conta.** `User.accountId` é singular por decisão: o isolamento entre contas fica verificável na identidade, e não dependente de cada query acertar o escopo. A consequência é que um executor terceiro que atenda clientes de **duas consultorias diferentes** terá dois logins — um por conta. Dentro de uma mesma conta, um login basta, por mais empresas que ele atenda (invariante 1).
>
> Para que essa escolha continue reversível, o token de sessão carrega `accountId` **explicitamente** e a aplicação trata "conta ativa" como conceito desde já, mesmo existindo apenas uma. Se um dia a identidade precisar atravessar contas, move-se `accountId` do `User` para o `Membership` sem reescrever a autenticação.

---

## 2. Empresa e planta

```typescript
interface CompanyGroup {
  id: string;
  accountId: string;
  name: string;                  // ex.: "Grupo BRF" — único na conta, sem distinguir acento/maiúscula
}

// Derivado, nunca gravado — exceto INACTIVE, que é o único que alguém decide.
type CompanyStatus =
  | 'IMPLANTATION'      // nenhum Gestor, nem convidado
  | 'AWAITING_MANAGER'  // Gestor convidado, nenhum aceitou
  | 'ACTIVE'            // ao menos um Gestor aceitou
  | 'INACTIVE';         // deactivatedAt preenchido: modo leitura

interface Company {
  id: string;
  accountId: string;
  groupId?: string;              // consolida relatórios; NÃO concede acesso

  corporateName: string;
  tradeName: string;
  slug: string;                  // "brf-toledo" — da URL; único na conta (03 §4)
  document: string;              // CNPJ
  stateRegistration?: string;

  contact: {
    name: string; role?: string;
    email: string; phone?: string; mobile?: string;
  };
  address: {
    zipCode: string; street: string; number: string;
    complement?: string; district: string; city: string; state: string;
  };

  externalCode?: string;         // código interno / ERP
  notes?: string;
  logoFileId?: string;           // aparece nos laudos
  deactivatedAt?: Date;          // preenchido = INACTIVE
  deactivatedByUserId?: string;
}

// O slug que a empresa já teve. Mantém funcionando o link antigo (favorito,
// e-mail) depois de um renome, e impede que outra empresa herde o endereço.
interface CompanySlugAlias {
  id: string;
  accountId: string;
  companyId: string;
  slug: string;                  // único na conta, junto com os slugs vigentes
}

interface Sector {
  id: string;
  accountId: string;
  companyId: string;
  name: string;                  // "Usinagem", "Caldeiraria"
  normalizedName: string;        // único na empresa: sem acento, caixa nem espaço sobrando
  description?: string;
  responsibleUserId?: string;
}
```

> **Por que `CompanyStatus` é calculado e não gravado:** três dos quatro estados decorrem de haver ou não Gestor, e um deles muda **sem evento nenhum** — o convite do Gestor expira por tempo, e a empresa volta a *em implantação* sem que ninguém aperte botão. Um status gravado mentiria até a próxima escrita. Só a desativação é ato de alguém, e só ela ocupa coluna.
>
> `groupId` agrupa **apenas para relatório do lado consultoria**. Pertencer ao mesmo grupo não altera escopo: a BRF continua sem enxergar a Seara. Qualquer consulta que use `groupId` precisa ser filtrada pelo escopo do operador antes de agrupar.

---

## 3. O eixo central: o Equipamento

```typescript
interface Equipment {
  id: string;
  accountId: string;
  companyId: string;
  sectorId?: string;

  code: string;                  // "EQ-0042" — sequencial por empresa, da URL (03 §4.2)

  // Identidade — do ativo, não da vistoria
  name: string;                  // "Prensa Hidráulica 100 Toneladas"
  machineTypeId?: string;        // do catálogo (§7) — global ou da consultoria
  model?: string;
  manufacturerName?: string;
  serialNumber?: string;
  manufactureYear?: number;
  tag?: string;                  // TAG de identificação na planta — única na empresa quando preenchida
  patrimonyCode?: string;        // número de patrimônio do cliente
  mainPhotoFileId?: string;

  // Ficha do ativo — características da máquina, não medidas da vistoria (03 §4.2)
  sheet: EquipmentSheet;

  // A foto principal é um FileAsset com `thumbnailKey`: a lista em cards lê só a miniatura.

  // Estado derivado, recalculado — nunca editado à mão
  worstCurrentHrn?: number;
  complianceStatus: 'NOT_ASSESSED' | 'NON_COMPLIANT' | 'IN_ADEQUACY' | 'COMPLIANT';
  openPointsCount: number;
  lastAnalysisAt?: Date;
  nextReviewAt?: Date;

  deactivatedAt?: Date;          // preenchido = fora do inventário, em modo leitura
  deactivatedByUserId?: string;
}
```

```typescript
interface EquipmentSheet {
  purpose?: string;              // "utilização": para que a máquina serve
  productiveCapacity?: string;   // texto: "10 t/h", "115200 ovos", "MIN 5,9 CX/MIN"
  powerKw?: number;
  controlStations?: number;      // postos de comando
  exposedOperators?: number;
  energySources: ('ELECTRIC' | 'PNEUMATIC' | 'HYDRAULIC' | 'MECHANICAL' | 'RADIOACTIVE')[];
  processDescription?: string;
  commonInterventions?: string;  // intervenções comuns do operador
  otherInfo?: string;

  dimensions: { heightMm?: number; widthMm?: number; depthMm?: number; weightKg?: number };
  manufacturer: {                // o nome do fabricante é identidade (`manufacturerName`)
    document?: string;           // CNPJ, só dígitos
    registry?: string;           // CREA
    address?: string; city?: string; zipCode?: string;
  };
}
```

> Só o nome é obrigatório — um cadastro que exige o que ninguém tem em mãos não é feito. **A fronteira:** o que é característica da máquina — identidade e ficha do ativo — é do `Equipment` e vale para todas as análises dela; o que se mede ou se observa na vistoria é da `TechnicalSheet`. A análise concluída guarda uma **cópia** do equipamento inteiro (`TechnicalSheet.equipment`), para que o laudo emitido não mude quando alguém corrigir o cadastro depois.
>
> `tag` é **opcional e única por empresa** (`@@unique([companyId, tag])`, com nulos livres): muita planta não etiqueta as máquinas, e exigir o campo travaria o cadastro e a migração. `serialNumber` e `patrimonyCode` não são únicos — repetição gera aviso, não recusa.
>
> `complianceStatus` e `worstCurrentHrn` são **projeções**, derivadas dos pontos. A fonte da verdade é sempre o conjunto de `RiskPoint`; estes campos existem para listagem e dashboard sem varrer a árvore inteira.

---

## 4. A análise (imutável ao concluir)

```typescript
interface Analysis {
  id: string;
  accountId: string;
  equipmentId: string;

  number: number;                // 1, 2, 3... por equipamento: a análise de 2022, a de 2024
  revision: number;              // 1, 2, 3... dentro do mesmo número — correção gera nova revisão
  supersedesAnalysisId?: string; // a revisão que esta substitui
  norm: 'NR-12';                 // sob qual norma a avaliação foi feita

  status: 'DRAFT' | 'CONCLUDED';
  startedAt: Date;
  concludedAt?: Date;
  fieldTechnicianUserId?: string;   // quem levantou em campo
  responsibleEngineerUserId?: string; // quem concluiu e assina
  artNumber?: string;

  hrnTableVersionId: string;     // qual versão das tabelas HRN foi usada
  technicalSheet: TechnicalSheet;
  frozenAt?: Date;
}
```

> **Número e revisão são coisas diferentes.** Voltar à mesma máquina dois anos depois é uma **análise nova** (`number + 1`, `revision: 1`). Corrigir uma análise já concluída é uma **revisão** dela (mesmo `number`, `revision + 1`). A análise se identifica por equipamento e número — `EQ-0042 · Análise 2` — e a revisão aparece só quando existe mais de uma.
>
> **`norm` reserva o eixo de norma.** Hoje toda análise é NR-12, e o campo não aparece em tela. Existe para que uma análise de outra norma possa conviver no mesmo equipamento sem reescrever a base migrada.
>
> **`hrnTableVersionId` é o que torna o laudo histórico reproduzível.** Sem ele, uma alteração futura de peso no catálogo global reescreveria retroativamente o risco de laudos já emitidos.
>
> **Congelar não é um `status` decorativo.** Ao concluir: a análise e todos os seus filhos (`RiskPoint`, `PapAssessment`, `PeAssessment`) tornam-se somente leitura, o equipamento recalcula o pior HRN e a situação de conformidade, as tarefas do plano de ação são geradas e o cliente é notificado. Correção posterior cria `revision + 1` apontando para a anterior via `supersedesAnalysisId`.

```typescript
interface TechnicalSheet {
  // Cópia do equipamento — identidade e ficha do ativo —, gravada ao concluir.
  // Enquanto a análise é rascunho, lê-se o Equipment, e corrigir aqui corrige lá.
  equipment?: {
    name: string; machineTypeName?: string; model?: string; manufacturerName?: string;
    serialNumber?: string; manufactureYear?: number; tag?: string; patrimonyCode?: string;
    sectorName?: string;
    sheet: EquipmentSheet;
  };

  // Medidos na vistoria
  times?: { cycleTimeSec?: number; activationTimeSec?: number; emergencyStopTimeSec?: number };
  shiftRegime?: string;          // regime de uso observado (turnos)

  // As seis perguntas de 03 §5.2, na mesma ordem e com o mesmo texto do legado
  safetyManagement: {
    maintenancePlannedByQualifiedProfessional: boolean;
    maintenanceRecorded: boolean;
    maintenanceRecordsAvailable: boolean;
    hasInstructionManual: boolean;
    hasWorkAndSafetyProcedures: boolean;
    workersTrained: boolean;
  };

  // 4 vistas obrigatórias
  recognitionPhotos: {
    front?: string; leftSide?: string; rightSide?: string; rear?: string;
  };
}
```

### Ponto de risco e HRN

```typescript
interface HrnScore {
  fe: number;   // frequência de exposição
  pe: number;   // probabilidade de ocorrência
  mpl: number;  // máxima perda possível
  np: number;   // pessoas expostas
  result: number;              // fe * pe * mpl * np
  level: RiskLevel;
}

type RiskLevel =
  | 'ACCEPTABLE' | 'VERY_LOW' | 'LOW' | 'SIGNIFICANT'
  | 'HIGH' | 'VERY_HIGH' | 'EXTREME' | 'UNACCEPTABLE';

interface RiskPoint {
  id: string;
  accountId: string;
  analysisId: string;
  equipmentId: string;           // desnormalizado: o ponto sobrevive à análise no plano de ação

  number: number;               // 1, 2, 3... na análise
  location: string;              // "Zona de prensagem"
  hazardOriginIds: string[];     // catálogo, várias por ponto
  hazardConsequenceIds: string[];// catálogo, várias por ponto
  existingProtectionIds: string[]; // catálogo de proteções, as que já estão instaladas
  violatedStandardIds: string[]; // itens da NR-12 descumpridos

  currentHrn: HrnScore;
  safetyCategory?: SafetyCategory; // opcional por ponto
  suggestedSolution: string;     // o que o cliente vai ler na execução
  hazardPhotoFileId?: string;    // a foto do "antes"

  // Preenchido pela consultoria apenas na etapa 6/7
  residualHrn?: HrnScore;

  // Só em análise migrada: a estimativa que o legado deixava escrever na própria análise
  estimatedResidualHrn?: HrnScore;
}

// Categoria de segurança pela NBR 14153, calculada pelas três respostas
interface SafetyCategory {
  severity: 1 | 2;               // S1 lesão leve · S2 lesão grave ou morte
  frequency?: 1 | 2;             // F1 raro a frequente · F2 frequente a contínuo — só com S2
  possibility?: 1 | 2;           // P1 possível evitar · P2 quase impossível — só com S2
  category: 1 | 2 | 3 | 4;       // calculada, nunca digitada
}
```

> **A regra da categoria é a do legado, para que o laudo migrado imprima o mesmo:** S1 → categoria 1; S2 com F1 e P1 → 2; S2 com F2 e P2 → 4; qualquer outra combinação com S2 → 3. O laudo imprime "Categoria N" e o gráfico de risco da norma; ponto sem categoria imprime "Não se aplica a categoria". No legado, 16% dos pontos têm categoria.
>
> **Origem, consequência e normas são de escolha múltipla** porque é o que a base mostra: 95% dos pontos têm mais de uma origem, 98% mais de uma consequência e 99% mais de uma norma — um ponto chega a 134 itens.
>
> **Residual estimado não se preenche na v2.** O legado permitia escrever, já na análise, o risco esperado depois do conserto; 112 de 287.921 pontos usaram. Na v2 o residual é o **verificado** pela consultoria depois da obra (`residualHrn`). A estimativa só existe nos pontos migrados, somente leitura, para que o laudo antigo continue reproduzível.

### PAP e PE

PAP e PE são **listas** dentro da análise, como os pontos de risco: uma máquina com dois painéis de comando tem dois PAP. No legado, 2.690 máquinas têm mais de um PAP (até 13) e 4.352 mais de um PE (até 19).

> **Sem justificativa por quesito.** O legado não tem, e o que o laudo precisa dizer sobre um quesito que não atende já está nas normas descumpridas e na solução do conjunto. Uma justificativa por quesito seriam 18 campos de texto por PAP que ninguém preencheria em campo.

> **As respostas ficam num JSON, não em 36 colunas.** Três seções × seis quesitos × duas dimensões. A API confere o formato na gravação e devolve sempre as três seções completas, com "Não" no que não veio.

```typescript
// PAP = dispositivos de Partida, Acionamento e Parada; PE = dispositivos de
// Parada de Emergência — as siglas da tela do legado (03 §5.2).

// Cada quesito é avaliado em duas dimensões, cada uma sim ou não. Nasce
// "Não" e "Não atende", como no legado — não há "sem resposta".
interface ChecklistAnswer {
  physicalState: boolean;   // a afirmação do quesito vale? (Sim / Não)
  nr12Compliant: boolean;   // atende à NR-12?
}

// Na ordem do legado. A chave é a coluna dele: activation*, stop*, reset*.
type PapSection = 'activation' | 'stop' | 'reset';   // Partida, Parada, Rearme

// Na ordem e com o texto da tela do legado. Em `accidental` e `antiFraud`,
// "Sim" é o ruim ("Passível de…").
type PapCriterion =
  | 'installed'     // Instalado
  | 'safeArea'      // Localizado em zona segura
  | 'accidental'    // Passível de acionamento acidental
  | 'antiFraud'     // Passível de burla
  | 'portuguese'    // Está identificado em língua portuguesa
  | 'ebt';          // Acionado em EBT ou por dupla isolação

// Um PAP é um conjunto de comando da máquina — um painel, uma botoeira —,
// com as três seções avaliadas juntas
interface PapAssessment {
  id: string;                      // UUID gerado no aparelho, como o do ponto
  accountId: string;
  analysisId: string;
  number: number;                  // 1, 2, 3... na análise
  location?: string;               // "Painel principal", "Botoeira da descarga"
  sections: Record<PapSection, {
    answers: Record<PapCriterion, ChecklistAnswer>;
    photoFileId?: string;          // sem foto, a seção não foi avaliada e não entra no laudo
  }>;
  violatedStandardIds: string[];   // parecer técnico: itens da seção 12.4
  solution?: string;               // possíveis soluções, uma para o conjunto
}

// Na ordem e com o texto da tela do legado (colunas de `pe`).
type PeCriterion =
  | 'installedDevices'    // Há dispositivos de seg. instalados
  | 'startupDevice'       // O dispositivo é usado para partida
  | 'triggeredByAnother'  // Pode ser acionado por outro operador
  | 'antiFraud'           // É passível de burla
  | 'portuguese'          // Está identificado em língua portuguesa
  | 'manualReset'         // Exige rearme manual
  | 'retention'           // Apresenta retenção após acionado
  | 'lowVoltage';         // Acionado em extrabaixa tensão

interface PeAssessment {
  id: string;
  accountId: string;
  analysisId: string;
  number: number;                  // 1, 2, 3... na análise
  location?: string;
  answers: Record<PeCriterion, ChecklistAnswer>;
  violatedStandardIds: string[];   // parecer técnico: itens da seção 12.6
  solution?: string;
  photoFileId?: string;            // no laudo do legado, as respostas do PE saem com ou sem foto
}
```

### Estudo de segurança

```typescript
interface SafetyStudy {
  id: string;
  accountId: string;
  equipmentId: string;
  summary: string;                 // lógica de intertravamento e solução de engenharia
  addressedRiskPointIds: string[];
  attachmentFileIds: string[];     // croquis, CAD, fotos editadas
}

interface ProposedProtection {
  id: string;
  studyId: string;
  name: string;
  technicalFeature?: string;
  standardReference?: string;
  installationStatus: 'PROPOSED' | 'PURCHASED' | 'INSTALLED';
}
```

---

## 5. O plano de ação

```typescript
type ActionStage =
  | 'RISK_ANALYSIS'        // 1 — descrito pela consultoria
  | 'STUDYING_ADEQUACY'    // 2 — eng. do cliente define responsável, prazo, orçamento
  | 'AWAITING_APPROVAL'    // 3 — gestor avalia
  | 'IN_EXECUTION'         // 4 — obra física
  | 'EXECUTION_FINISHED'   // 5 — evidência entregue
  | 'CONSULTANCY_REVIEW'   // 6 — consultoria confere
  | 'CONFORMED';           // 7 — final

interface ActionItem {
  id: string;
  accountId: string;
  companyId: string;
  equipmentId: string;
  riskPointId: string;           // a origem — cabeçalho somente leitura no cartão

  stage: ActionStage;

  // Designação — Engenheiro do Cliente
  executionType?: 'INTERNAL' | 'THIRD_PARTY';
  responsibleUserId?: string;
  additionalExecutors?: { userId: string; specialty: string }[];
  plannedStartAt?: Date;
  dueAt?: Date;
  executionNotes?: string;

  // Orçamento
  budgetTotalCents?: number;      // soma das linhas, calculado
  externalQuoteFileId?: string;

  // Aprovação — Gestor
  approvalStatus: 'NOT_SUBMITTED' | 'PENDING' | 'APPROVED' | 'REJECTED';
  approvedByUserId?: string;
  approvedAt?: Date;
  approvalJustification?: string; // obrigatório na reprovação
  budgetFrozenAt?: Date;

  // Evidência — obrigatórios os dois para sair da etapa 4
  evidencePhotoFileIds?: string[];
  evidenceDescription?: string;
  executionFinishedAt?: Date;
  complementaryFileIds?: string[]; // NF, certificado, ART do instalador

  // Validação — consultoria
  validatedByUserId?: string;
  validatedAt?: Date;
  isOverdue: boolean;             // derivado de dueAt
}

interface BudgetLine {
  id: string;
  actionItemId: string;
  priceItemId?: string;           // referência à tabela de preços
  description: string;            // snapshot: sobrevive à desativação do item
  supplierId?: string;
  quantity: number;
  unitPriceCents: number;         // snapshot do preço no momento do orçamento
  subtotalCents: number;
}

// Comentários de andamento durante a execução
interface ActionComment {
  id: string;
  actionItemId: string;
  authorUserId: string;
  text: string;
  createdAt: Date;
}
```

> **Por que `BudgetLine` guarda `description` e `unitPriceCents` em vez de só referenciar `PriceItem`:** o preço de uma peça de segurança muda. O orçamento aprovado pelo Gestor precisa continuar mostrando exatamente o valor que ele aprovou, mesmo que o item seja reajustado ou desativado depois.
>
> **`stage` nunca é escrito diretamente.** Toda mudança passa pela tabela de transições de [02 — Ciclo de Adequação](./02_ciclo_de_adequacao.md), que valida papel, pré-condições e grava `StageTransition`.

```typescript
interface StageTransition {
  id: string;
  actionItemId: string;
  fromStage: ActionStage | null;
  toStage: ActionStage;
  actorUserId: string;
  justification?: string;         // obrigatório em toda reprovação
  occurredAt: Date;
}
```

> `StageTransition` é **append-only**. As reprovações se acumulam; o histórico do ponto nunca é sobrescrito.

---

## 6. Custos: tabela de preços e fornecedores

Pertencem à **empresa cliente**, não à consultoria.

```typescript
interface Supplier {
  id: string;
  accountId: string;
  companyId: string;              // a base é da empresa
  name: string;
  document?: string;
  contactName?: string;
  phone?: string;
  email?: string;
  supplyCategory?: string;
  notes?: string;
  isActive: boolean;
}

interface PriceItem {
  id: string;
  accountId: string;
  companyId: string;
  description: string;            // "Botoeira de emergência tipo cogumelo com trava"
  category: 'PART' | 'MATERIAL' | 'LABOR' | 'SERVICE' | 'OTHER';
  supplierId?: string;
  unitPriceCents: number;
  unit: string;                   // un, m, kg, h, serviço
  sku?: string;
  technicalNote?: string;         // especificação, norma atendida, link do catálogo
  lastQuotedAt?: Date;
  isActive: boolean;              // inativo some das buscas, permanece nos orçamentos antigos
}

interface PriceItemHistory {
  id: string;
  priceItemId: string;
  previousPriceCents: number;
  newPriceCents: number;
  changedByUserId: string;
  changedAt: Date;
}
```

> A tabela **se constrói pelo uso**: o cadastro inline durante o orçamento é o caminho principal de entrada, não a exceção. Um `PriceItem` criado assim já nasce vinculado à `companyId` do contexto.

---

## 7. Catálogos

### Globais — mantidos pela plataforma, compartilhados por todas as contas

```typescript
// A norma se organiza em capítulos e anexos: "12.5 Sistemas de segurança",
// "Anexo VIII - Prensas e similares". São 27 no legado, com 857 itens.
interface StandardSection {
  id: string;
  norm: 'NR-12';
  name: string;
  order: number;
}

interface Standard {                 // item da norma
  id: string;
  norm: 'NR-12';
  sectionId: string;
  itemCode: string;                  // "12.38.1"
  text: string;
  isActive: boolean;
}

interface MachineType       { id: string; name: string; normalizedName: string; accountId?: string; }

// O perigo se organiza por tipo: mecânico, elétrico, térmico...
interface HazardType        { id: string; name: string; }
interface HazardOrigin      { id: string; hazardTypeId: string; name: string; accountId?: string; }
interface HazardConsequence { id: string; hazardTypeId: string; name: string; accountId?: string; }

// A proteção também: "Proteção fixa", "Barreira óptica" são tipos; o dispositivo é o item
interface ProtectionType    { id: string; name: string; }
interface Protection        { id: string; protectionTypeId: string; name: string; accountId?: string; }
```

> `accountId` **opcional** nos catálogos de tipo de máquina, de perigo e de proteção: quando nulo, o registro é global; quando preenchido, é uma extensão privada daquela consultoria ("Meus Cadastros"). Consultas devem sempre unir os dois conjuntos.

### Tabelas HRN — versionadas

```typescript
interface HrnTableVersion {
  id: string;
  label: string;                     // "Vigente desde 2024-01"
  effectiveFrom: Date;
  effectiveTo?: Date;                // nulo = vigente
  factors: {
    fe: HrnFactorOption[];
    pe: HrnFactorOption[];
    mpl: HrnFactorOption[];
    np: HrnFactorOption[];
  };
  levels: { level: RiskLevel; label: string; minExclusive: number | null; maxInclusive: number | null }[];
}

interface HrnFactorOption {
  weight: number;
  label: string;
  helpText?: string;                 // a ajuda visual de aplicação técnica
}
```

**Valores da versão vigente — idênticos ao sistema legado, por exigência de reprodutibilidade:**

| FE — Frequência de exposição | | PE — Probabilidade | | MPL — Máxima perda | | NP — Pessoas expostas | |
| :-- | :-- | :-- | :-- | :-- | :-- | :-- | :-- |
| 0,5 | Anualmente | 0,03 | Quase impossível | 0,1 | Arranhão / contusão leve | 1 | 1-2 pessoas |
| 1,0 | Mensalmente | 1,0 | Altamente improvável | 0,5 | Dilaceração / doenças moderadas | 2 | 3-7 pessoas |
| 1,5 | Semanalmente | 1,5 | Improvável | 2,0 | Fratura / enfermidade leve | 4 | 8-15 pessoas |
| 2,5 | Diariamente | 2,0 | Possível | 4,0 | Fratura / enfermidade grave | 8 | 16-50 pessoas |
| 4,0 | Em termos de hora | 5,0 | Alguma chance | 6,0 | Perda de um membro / olho | 12 | Mais que 50 pessoas |
| 5,0 | Constantemente | 8,0 | Provável | 10,0 | Perda de dois membros / olhos | | |
| | | 10,0 | Muito provável | 15,0 | Fatalidade | | |
| | | 15,0 | Certo | | | | |

**Faixas de classificação:**

| Faixa de HRN | `RiskLevel` | Rótulo |
| :--- | :--- | :--- |
| até 1 | `ACCEPTABLE` | Risco Aceitável |
| acima de 1 até 5 | `VERY_LOW` | Risco Muito Baixo |
| acima de 5 até 10 | `LOW` | Risco Baixo |
| acima de 10 até 50 | `SIGNIFICANT` | Risco Significante |
| acima de 50 até 100 | `HIGH` | Risco Alto |
| acima de 100 até 500 | `VERY_HIGH` | Risco Muito Alto |
| acima de 500 até 1000 | `EXTREME` | Risco Extremo |
| acima de 1000 | `UNACCEPTABLE` | Risco Inaceitável |

> **As faixas não têm buraco.** É a regra do laudo do legado (`> 1 e ≤ 5`…). A tela do legado escrevia "de 1,1 a 5", e o único resultado possível entre 1 e 1,1 — **1,08**, uma das 1.680 combinações de pesos — caía em "Inaceitável" na tela e em "Muito Baixo" no laudo. Vale o laudo, que é o documento emitido.

> **`ACCEPTABLE` é o corte operacional do sistema.** Ponto nessa faixa não exige medida de engenharia: não gera `ActionItem`, não entra no plano de ação e não conta no portão do Laudo de Adequação. Todas as demais faixas geram tarefa.
>
> ⚠️ Estes valores **não são configuração de aplicação**. Alterá-los sem criar nova `HrnTableVersion` quebra a reprodutibilidade de todo laudo já emitido.

### Da consultoria — "Meus Cadastros"

```typescript
interface SolutionTemplate {          // textos padrão de solução reaproveitáveis
  id: string;
  accountId: string;
  category?: string;
  title: string;
  text: string;
}

interface AnalysisTemplate {          // modelo de checklist por tipo de máquina
  id: string;
  accountId: string;
  machineTypeId: string;             // o tipo do catálogo (§7)
  presetRiskPoints?: Partial<RiskPoint>[];
}
```

---

## 8. Documentos, arquivos e histórico

```typescript
interface FileAsset {
  id: string;
  accountId: string;
  companyId?: string;
  equipmentId?: string;

  title?: string;
  description?: string;
  category?: string;
  storageKey: string;              // caminho no storage
  mimeType: string;
  sizeBytes: number;

  thumbnailKey?: string;           // gerado no upload, para listagens
  visibility: 'CONSULTANCY_ONLY' | 'CLIENT_VISIBLE';
  expiresAt?: Date;                // documentos que vencem (PGR, certificados)

  capturedAt?: Date;
  capturedByUserId?: string;
  geolocation?: { lat: number; lng: number };
}
```

> `visibility` é regra de negócio, não de interface. Um arquivo `CONSULTANCY_ONLY` não pode aparecer em nenhuma resposta de API para papéis do lado cliente.

```typescript
interface Report {
  id: string;
  accountId: string;
  equipmentId?: string;
  companyId: string;
  type: 'RISK_APPRAISAL' | 'ADEQUACY' | 'MANAGEMENT';
  analysisId?: string;             // a análise base
  version: number;                 // reemissão preserva a anterior
  format: 'PDF' | 'DOCX';
  signedByUserId: string;
  artNumber?: string;
  fileId: string;
  issuedAt: Date;
}
```

> **Portão do Laudo de Adequação:** só pode ser emitido quando **todos os `ActionItem` do equipamento** estiverem em `CONFORMED`. A validação é do servidor, não do botão.
>
> O portão conta `ActionItem`, **não** `RiskPoint`. Como só gera `ActionItem` o ponto com `currentHrn.level !== 'ACCEPTABLE'`, o conjunto avaliado pelo portão é exatamente o conjunto que precisava ser adequado — um `RiskPoint` aceitável nunca entra na conta e nunca trava a emissão. Equipamento sem nenhum `ActionItem` não tem Laudo de Adequação a emitir: seu documento é o de Apreciação de Riscos.

```typescript
interface TimelineEvent {          // alimenta os históricos de empresa e equipamento
  id: string;
  accountId: string;
  companyId?: string;
  equipmentId?: string;
  actionItemId?: string;
  type: string;                    // "ANALYSIS_CONCLUDED", "BUDGET_APPROVED", ...
  description: string;             // texto já renderizado para exibição
  actorUserId?: string;
  occurredAt: Date;
}

interface AuditLog {               // trilha técnica: quem, quando, o quê, por quê
  id: string;
  accountId?: string;
  actorUserId?: string;            // ausente quando não há autor a atribuir
  action: string;
  entityType: string;
  entityId: string;
  before?: unknown;
  after?: unknown;
  reason?: string;
  ipAddress?: string;
  userAgent?: string;
  occurredAt: Date;
}

interface Notification {
  id: string;
  accountId: string;
  recipientUserId: string;
  type: string;
  title: string;
  body: string;
  linkTo: string;                  // rota de destino
  readAt?: Date;
  emailSentAt?: Date;
}
```

> `TimelineEvent` é a narrativa legível pelo usuário; `AuditLog` é o registro técnico completo, incluindo impersonação e alteração de catálogo. São coisas diferentes e não devem ser fundidas.
>
> **`actorUserId` é opcional** porque o evento mais importante da trilha de autenticação é justamente o que não tem autor: uma tentativa de login com e-mail que não existe em conta nenhuma. Exigir autor obrigaria a inventar um, ou a não registrar o evento — e é ele que denuncia um ataque em andamento.
>
> **Credencial nunca entra em `before`/`after`.** Nem senha, nem hash, nem token de convite ou de redefinição. A trilha registra o que mudou, não com o quê.

---

## 9. O fluxo completo, do cadastro ao laudo

1. Josué cadastra a **`Company`** BRF sob sua **`Account`**, e cria o `Membership` do Marcos com `roles: ['MANAGER']`.
2. Cadastra-se um **`Equipment`** (Prensa Hidráulica) com `complianceStatus: 'NOT_ASSESSED'`.
3. Fernando abre uma **`Analysis`** (`number: 1`, `revision: 1`, `status: 'DRAFT'`) e preenche `TechnicalSheet`, os `RiskPoint` com `currentHrn`, um `PapAssessment` por conjunto de comando e os `PeAssessment`.
4. Carla **conclui a análise**: `status: 'CONCLUDED'`, `frozenAt` preenchido, `hrnTableVersionId` fixado. Tudo abaixo vira somente leitura.
5. O sistema gera um **`ActionItem`** por `RiskPoint` com `currentHrn.level !== 'ACCEPTABLE'`, em `stage: 'STUDYING_ADEQUACY'`, e notifica a BRF. Pontos aceitáveis não geram tarefa e permanecem apenas como registro da análise.
6. Antonio designa `responsibleUserId`, `dueAt` e monta as **`BudgetLine`** — buscando `PriceItem` da BRF e cadastrando inline o que faltar. Envia: `stage: 'AWAITING_APPROVAL'`.
7. Marcos aprova: `approvedByUserId`, `budgetFrozenAt`, `stage: 'IN_EXECUTION'`.
8. Rafael executa e finaliza com `evidencePhotoFileIds` **e** `evidenceDescription` — os dois obrigatórios. `stage: 'CONSULTANCY_REVIEW'`.
9. Carla confere. Reprova com justificativa (volta para `IN_EXECUTION`) ou aprova, preenche `residualHrn` no `RiskPoint` e move para `CONFORMED`.
10. Quando **todos** os `ActionItem` do equipamento estão em `CONFORMED`, o `Equipment.complianceStatus` vira `COMPLIANT` e o **`Report`** do tipo `ADEQUACY` é liberado.

Cada passo grava `StageTransition`, `TimelineEvent`, `AuditLog` e dispara as `Notification` correspondentes.
