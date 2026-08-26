# 04 — Modelo de Dados

Entidades, relacionamentos e contratos que suportam o ciclo de adequação. As interfaces são descritas em TypeScript porque é assim que trafegam entre a API, o painel web e o app de campo — vivem em `packages/shared` e são consumidas pelos três.

**Convenções gerais:**
- Toda entidade de negócio carrega `accountId`. É o limite absoluto de isolamento, aplicado no servidor, nunca só na interface.
- Toda entidade carrega `createdAt`, `updatedAt` e `createdByUserId`. Omitidos abaixo por brevidade quando não são relevantes à regra.
- Nada é apagado fisicamente. Desativação usa `isActive` ou `disabledAt`.
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
type Role =
  | 'SYSTEM_ADMIN'
  | 'LEAD_ENGINEER'        // Engenheiro Responsável — consultoria
  | 'CONSULTANT_ENGINEER'  // Engenheiro da Consultoria
  | 'TECHNICIAN'           // Técnico
  | 'MANAGER'              // Gestor — cliente
  | 'CLIENT_ENGINEER'      // Engenheiro do Cliente
  | 'DIRECTOR'             // Diretor — leitura
  | 'EXECUTOR';            // Executor

type RoleSide = 'PLATFORM' | 'CONSULTANCY' | 'CLIENT' | 'EXTERNAL';

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
2. Toda empresa ativa tem ao menos um `Membership` ativo contendo `MANAGER`.
3. No convite, o conjunto de empresas oferecido é subconjunto do escopo de quem convida.
4. Todo `Membership` de um usuário pertence à mesma `Account` do `User` — o vínculo nunca atravessa contas.

> **A identidade pertence a uma conta.** `User.accountId` é singular por decisão: o isolamento entre contas fica verificável na identidade, e não dependente de cada query acertar o escopo. A consequência é que um executor terceiro que atenda clientes de **duas consultorias diferentes** terá dois logins — um por conta. Dentro de uma mesma conta, um login basta, por mais empresas que ele atenda (invariante 1).
>
> Para que essa escolha continue reversível, o token de sessão carrega `accountId` **explicitamente** e a aplicação trata "conta ativa" como conceito desde já, mesmo existindo apenas uma. Se um dia a identidade precisar atravessar contas, move-se `accountId` do `User` para o `Membership` sem reescrever a autenticação.

---

## 2. Empresa e planta

```typescript
interface CompanyGroup {
  id: string;
  accountId: string;
  name: string;                  // ex.: "Grupo BRF"
}

interface Company {
  id: string;
  accountId: string;
  groupId?: string;              // consolida relatórios; NÃO concede acesso

  corporateName: string;
  tradeName: string;
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
  isActive: boolean;
}

interface Sector {
  id: string;
  accountId: string;
  companyId: string;
  name: string;                  // "Usinagem", "Caldeiraria"
  description?: string;
  responsibleUserId?: string;
}
```

> `groupId` agrupa **apenas para relatório do lado consultoria**. Pertencer ao mesmo grupo não altera escopo: a BRF continua sem enxergar a Seara. Qualquer consulta que use `groupId` precisa ser filtrada pelo escopo do operador antes de agrupar.

---

## 3. O eixo central: o Equipamento

```typescript
interface Equipment {
  id: string;
  accountId: string;
  companyId: string;
  sectorId?: string;

  name: string;                  // "Prensa Hidráulica 100 Toneladas"
  tag: string;                   // TAG de identificação na planta
  model?: string;
  manufacturerName?: string;
  patrimonyCode?: string;
  mainPhotoFileId?: string;

  // Estado derivado, recalculado — nunca editado à mão
  worstCurrentHrn?: number;
  complianceStatus: 'NOT_ASSESSED' | 'NON_COMPLIANT' | 'IN_ADEQUACY' | 'COMPLIANT';
  openPointsCount: number;
  lastAnalysisAt?: Date;
  nextReviewAt?: Date;

  isActive: boolean;
}
```

> O cadastro inicial é enxuto de propósito — a ficha técnica densa é preenchida durante a análise, não no momento de criar o registro.
>
> `complianceStatus` e `worstCurrentHrn` são **projeções**, derivadas dos pontos. A fonte da verdade é sempre o conjunto de `RiskPoint`; estes campos existem para listagem e dashboard sem varrer a árvore inteira.

---

## 4. A análise (imutável ao concluir)

```typescript
interface Analysis {
  id: string;
  accountId: string;
  equipmentId: string;

  revision: number;              // 1, 2, 3... — correção gera nova revisão
  supersedesAnalysisId?: string; // a revisão que esta substitui

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

> **`hrnTableVersionId` é o que torna o laudo histórico reproduzível.** Sem ele, uma alteração futura de peso no catálogo global reescreveria retroativamente o risco de laudos já emitidos.
>
> **Congelar não é um `status` decorativo.** Ao concluir: a análise e todos os seus filhos (`RiskPoint`, `PapAssessment`, `PeAssessment`) tornam-se somente leitura, as tarefas do plano de ação são geradas e o cliente é notificado. Correção posterior cria `revision + 1` apontando para a anterior via `supersedesAnalysisId`.

```typescript
interface TechnicalSheet {
  machineType?: string;
  manufactureYear?: number;
  serialNumber?: string;

  manufacturer?: {
    name: string; document?: string; registry?: string;
    address?: string; city?: string; zipCode?: string;
  };

  dimensions?: { heightMm?: number; widthMm?: number; depthMm?: number; weightKg?: number };

  production?: {
    capacity?: string; powerKw?: number;
    cycleTimeSec?: number; activationTimeSec?: number; emergencyStopTimeSec?: number;
  };

  operation?: {
    controlStations?: number; exposedOperators?: number; shiftRegime?: string;
    processDescription?: string; commonInterventions?: string; otherInfo?: string;
  };

  energySources: {
    electric: boolean; pneumatic: boolean; hydraulic: boolean;
    mechanical: boolean; radioactive: boolean; extraction: boolean;
  };

  safetyManagement: {
    hasManualInPortuguese: boolean;
    hasFormalProcedures: boolean;
    hasRegisteredMaintenance: boolean;
    hasMaintenancePlan: boolean;
    recordsAvailableAtInspection: boolean;
  };

  // 4 vistas obrigatórias
  recognitionPhotos: {
    front?: string; leftSide?: string; rightSide?: string; top?: string;
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

  location: string;              // "Zona de prensagem"
  hazardOriginId?: string;       // catálogo
  hazardConsequenceId?: string;  // catálogo
  existingProtections?: string;
  violatedStandardIds: string[]; // itens da NR-12 descumpridos
  usageCategory?: string;

  currentHrn: HrnScore;
  suggestedSolution: string;     // o que o cliente vai ler na execução
  hazardPhotoFileId?: string;    // a foto do "antes"

  // Preenchido pela consultoria apenas na etapa 6/7
  residualHrn?: HrnScore;
}
```

### PAP e PE

```typescript
// Cada quesito é avaliado em duas dimensões independentes
interface ChecklistAnswer {
  physicalState: boolean | null;   // existe / está assim?
  nr12Compliant: boolean | null;   // atende à norma?
  justification?: string;          // obrigatório quando não conforme
}

type PapSection = 'ACTIVATION' | 'RESET' | 'EMERGENCY_STOP';

type PapCriterion =
  | 'INSTALLED'          // o dispositivo existe?
  | 'ACCIDENTAL'         // proteção contra toque involuntário?
  | 'ANTI_FRAUD'         // difícil de burlar ou travar?
  | 'SAFE_AREA'          // aciona sem expor as mãos?
  | 'EXTRA_LOW_VOLTAGE'  // tensão de comando segura (máx. 24V)?
  | 'PORTUGUESE';        // sinalização clara em português?

interface PapAssessment {
  id: string;
  accountId: string;
  analysisId: string;
  section: PapSection;
  answers: Record<PapCriterion, ChecklistAnswer>;
  solution?: string;
  photoFileId?: string;
}

type PeCriterion =
  | 'STARTUP_DEVICE_WEAR' | 'LOW_VOLTAGE_ABSENT' | 'FIXED_SWITCH_RESET'
  | 'PORTUGUESE_SIGNAGE' | 'TAMPERED_CONTROLS' | 'OPEN_GUARDS_NO_INTERLOCK'
  | 'TRIGGERED_BY_ANOTHER' | 'NO_POWER_LOSS_RETENTION';

interface PeAssessment {
  id: string;
  accountId: string;
  analysisId: string;
  answers: Record<PeCriterion, ChecklistAnswer>;
  solution?: string;
  photoFileId?: string;
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
interface Standard {                 // item da NR-12 e correlatas
  id: string;
  groupCode: string;                 // "NR-12", "NR-10"
  itemCode: string;                  // "12.38.1"
  title: string;
  text: string;
  isActive: boolean;
}

interface HazardOrigin      { id: string; name: string; accountId?: string; }
interface HazardConsequence { id: string; name: string; accountId?: string; }
interface ProtectionType    { id: string; name: string; accountId?: string; }
```

> `accountId` **opcional** nos catálogos de perigo: quando nulo, o registro é global; quando preenchido, é uma extensão privada daquela consultoria ("Meus Cadastros"). Consultas devem sempre unir os dois conjuntos.

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
  levels: { level: RiskLevel; minExclusive: number | null; maxInclusive: number | null }[];
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
| ≤ 1,0 | `ACCEPTABLE` | Risco Aceitável |
| 1,1 – 5,0 | `VERY_LOW` | Risco Muito Baixo |
| 5,1 – 10,0 | `LOW` | Risco Baixo |
| 10,1 – 50,0 | `SIGNIFICANT` | Risco Significante |
| 50,1 – 100,0 | `HIGH` | Risco Alto |
| 100,1 – 500,0 | `VERY_HIGH` | Risco Muito Alto |
| 500,1 – 1000,0 | `EXTREME` | Risco Extremo |
| > 1000,0 | `UNACCEPTABLE` | Risco Inaceitável |

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
  machineType: string;
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
  actorUserId: string;
  action: string;
  entityType: string;
  entityId: string;
  before?: unknown;
  after?: unknown;
  reason?: string;
  ipAddress?: string;
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

---

## 9. O fluxo completo, do cadastro ao laudo

1. Josué cadastra a **`Company`** BRF sob sua **`Account`**, e cria o `Membership` do Marcos com `roles: ['MANAGER']`.
2. Cadastra-se um **`Equipment`** (Prensa Hidráulica) com `complianceStatus: 'NOT_ASSESSED'`.
3. Fernando abre uma **`Analysis`** (`revision: 1`, `status: 'DRAFT'`) e preenche `TechnicalSheet`, os `RiskPoint` com `currentHrn`, os três `PapAssessment` e o `PeAssessment`.
4. Carla **conclui a análise**: `status: 'CONCLUDED'`, `frozenAt` preenchido, `hrnTableVersionId` fixado. Tudo abaixo vira somente leitura.
5. O sistema gera um **`ActionItem`** por `RiskPoint` com `currentHrn.level !== 'ACCEPTABLE'`, em `stage: 'STUDYING_ADEQUACY'`, e notifica a BRF. Pontos aceitáveis não geram tarefa e permanecem apenas como registro da análise.
6. Antonio designa `responsibleUserId`, `dueAt` e monta as **`BudgetLine`** — buscando `PriceItem` da BRF e cadastrando inline o que faltar. Envia: `stage: 'AWAITING_APPROVAL'`.
7. Marcos aprova: `approvedByUserId`, `budgetFrozenAt`, `stage: 'IN_EXECUTION'`.
8. Rafael executa e finaliza com `evidencePhotoFileIds` **e** `evidenceDescription` — os dois obrigatórios. `stage: 'CONSULTANCY_REVIEW'`.
9. Carla confere. Reprova com justificativa (volta para `IN_EXECUTION`) ou aprova, preenche `residualHrn` no `RiskPoint` e move para `CONFORMED`.
10. Quando **todos** os `ActionItem` do equipamento estão em `CONFORMED`, o `Equipment.complianceStatus` vira `COMPLIANT` e o **`Report`** do tipo `ADEQUACY` é liberado.

Cada passo grava `StageTransition`, `TimelineEvent`, `AuditLog` e dispara as `Notification` correspondentes.
