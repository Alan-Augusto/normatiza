# Estrutura do Banco de Dados e Entidades (Typescript Interfaces)

Nesta documentação, detalhamos o modelo de dados projetado para suportar a nova arquitetura orientada a **Equipamentos (Ativos)** e o fluxo de conformidade (PDCA) do Normatiza. 

As entidades são descritas utilizando interfaces Typescript para refletir exatamente como os modelos transitarão entre o Backend (Node.js) e o Frontend/Mobile (Angular).

---

## 1. Entidades Core e Multitenancy

A base do sistema garante o isolamento de dados. Tudo orbita em torno de um `Tenant` (O Engenheiro / Consultoria assinante do software) e seus `Customers` (As Indústrias).

```typescript
// O dono da conta na plataforma (Engenheiro de Segurança / Consultoria)
interface Tenant {
  id: string;
  name: string;
  document: string; // CNPJ/CPF
  isActive: boolean;
  createdAt: Date;
  // Regras de negócio globais (ex: limitações de plano SaaS)
}

// O Cliente final (Indústria onde as vistorias ocorrem)
interface Customer {
  id: string;
  tenantId: string; // Amarração de segurança
  corporateName: string;
  tradeName: string;
  document: string; // CNPJ
  contactEmail: string;
  createdAt: Date;
}

// Setorização geográfica da fábrica (Onde a máquina está fisicamente)
interface Sector {
  id: string;
  customerId: string;
  name: string; // Ex: "Usinagem", "Caldeiraria"
  description?: string;
}
```

---

## 2. O Eixo Central: O Equipamento (Ativo)

A entidade mais importante da nova arquitetura. O equipamento é o repositório central que acumulará o histórico de todas as análises de todas as normas.

```typescript
// O Ativo em si
interface Equipment {
  id: string;
  customerId: string;
  sectorId?: string;
  
  // Dados Técnicos (A "Ficha Técnica")
  name: string; // Ex: "Prensa Hidráulica 100 Toneladas"
  manufacturer: string;
  model: string;
  serialNumber?: string;
  manufactureYear?: number;
  patrimonyCode?: string; // Tag de inventário
  
  // Dimensões e Operação
  weightKg?: number;
  heightMm?: number;
  widthMm?: number;
  depthMm?: number;
  capacity?: string;
  operatorsCount: number;
  
  // Fontes de Energia
  energySources: {
    electric: boolean;
    pneumatic: boolean;
    hydraulic: boolean;
    mechanical: boolean;
    radioactive: boolean;
  };
  
  // Status Vivo (Para o Dashboard)
  status: 'COMPLIANT' | 'NON_COMPLIANT' | 'IN_MAINTENANCE' | 'DEACTIVATED';
  
  createdAt: Date;
  updatedAt: Date;
}

// Arquivos genéricos do equipamento (Manuais em PDF, Planta baixa)
interface EquipmentDocument {
  id: string;
  equipmentId: string;
  title: string; // Ex: "Manual do Fabricante"
  fileUrl: string; // Firebase Storage URL
  uploadDate: Date;
}
```

---

## 3. O Módulo NR-12

As entidades abaixo são geradas quando o usuário decide avaliar o `Equipment` sob a ótica da NR-12.

```typescript
// Uma sessão de avaliação para um equipamento em um ponto no tempo
interface InspectionNr12 {
  id: string;
  equipmentId: string;
  inspectorId: string; // Quem fez a vistoria
  inspectionDate: Date;
  
  // Status do Ciclo PDCA do Josué
  phase: 'DRAFT' | 'RISK_ASSESSMENT' | 'ACTION_PLAN_PENDING' | 'REVALIDATION' | 'CONCLUDED';
}

// Apreciação de Risco (Cálculo HRN) - Pode haver múltiplos perigos em uma inspeção
interface RiskAssessment {
  id: string;
  inspectionNr12Id: string;
  
  // O Perigo e Localização
  dangerZone: string; // Ex: "Zona de Prensagem"
  dangerDescription: string; // Ex: "Risco de esmagamento das mãos"
  photoUrl: string; 
  
  // Cálculo HRN Atual
  currentHrn: {
    fe: number; // Frequência de Exposição
    pe: number; // Probabilidade
    mpl: number; // Máxima Perda Possível
    np: number;  // Número de Pessoas
    resultValue: number;
    riskLevel: string; // Ex: "Alto", "Inaceitável"
  };

  // Cálculo HRN Residual (Pós-Revalidação)
  residualHrn?: {
    fe: number;
    pe: number;
    mpl: number;
    np: number;
    resultValue: number;
    riskLevel: string;
  };
}
```

---

## 4. O Coração Operacional: Gestão de Adequação (Plano de Ação)

Para suportar o "Banco de Dados de Adequação" do Josué e o controle de execução (Kanban).

```typescript
// Banco de soluções padronizadas (Cadastrado globalmente pelo sistema)
interface StandardSolutionCategory {
  id: string;
  name: string; // Ex: "Instalar Proteção Física", "Adequar Sistema de Controle"
}

interface StandardSolution {
  id: string;
  categoryId: string;
  description: string; // Ex: "Instalação de Cortina de Luz (Categoria 4)"
}

// A Tarefa em si (Gerada a partir de um Risco encontrado)
interface ActionPlanTask {
  id: string;
  riskAssessmentId: string; // O Risco que esta tarefa visa mitigar
  
  // O que fazer (Ligado ao banco padronizado)
  solutionId: string; 
  customObservation?: string;
  
  // Gestão de Execução (Preenchido pela Indústria/Cliente)
  status: 'TODO' | 'IN_PROGRESS' | 'DELAYED' | 'DONE';
  responsibleName?: string;
  deadline?: Date;
  investmentCost?: number;
  
  // Evidência de Conclusão (Obrigatoriedade)
  executionEvidencePhotoUrl?: string;
  executionDate?: Date;
}
```

---

## 5. Explicação Detalhada do Relacionamento (O Fluxo Real)

1.  Um novo `Customer` (Empresa XPTO) é criado sob o escopo do `Tenant` logado.
2.  Dentro da Empresa XPTO, cadastra-se um `Equipment` (Prensa Hidráulica). Este equipamento nasce com o `status = NON_COMPLIANT`.
3.  Cria-se uma `InspectionNr12` vinculada à Prensa. O sistema a inicia na fase `RISK_ASSESSMENT`.
4.  O engenheiro identifica 2 pontos de esmagamento e cria 2 `RiskAssessment` (cálculo HRN) ligados àquela inspeção.
5.  O sistema (ou o engenheiro) aponta que a máquina não atende a norma. A `InspectionNr12` avança para a fase `ACTION_PLAN_PENDING`.
6.  Para cada `RiskAssessment`, cria-se uma `ActionPlanTask` escolhendo soluções do catálogo `StandardSolution` (Ex: "Instalar cortina de luz").
7.  A equipe de manutenção da fábrica visualiza as tarefas `ActionPlanTask`, realiza a compra e instalação física das grades/sensores e marca a tarefa como `DONE`, anexando a `executionEvidencePhotoUrl`.
8.  O engenheiro revalida a inspeção, preenche o `residualHrn` provando que o risco caiu e muda a fase da inspeção para `CONCLUDED`.
9.  O `Equipment` muda de status permanentemente para `COMPLIANT`.
10. O `Laudo Técnico` é liberado para geração em PDF.
