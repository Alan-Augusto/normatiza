# Processo de Reestruturação do Sistema Normatiza

Este documento detalha o panorama atual do sistema Normatiza, os motivos que nos levam à sua reestruturação completa e a nova visão arquitetural e estratégica que norteará o desenvolvimento.

---

## 1. O Cenário Atual

Atualmente, o Normatiza opera primariamente como um **"Gerador de Laudos"**. O fluxo do sistema gravita em torno do evento da "Análise". 

*   **Fluxo Principal:** O engenheiro vai a campo, cadastra uma análise, insere os equipamentos atrelados a ela, aponta os riscos (cálculo HRN) e as falhas estruturais (PAP/PE), e ao final clica em gerar um arquivo PDF ou Word.
*   **Limitação do Modelo:** Uma vez gerado o PDF, a vida útil daquela informação no sistema praticamente acaba. A máquina é vista como um objeto estático que pertence a uma avaliação de uma data específica. Não há um rastreamento contínuo de manutenção ou evolução do ativo ao longo dos anos.
*   **Ponto Focal:** A "Análise" é a entidade central.

## 2. A Nova Visão Estratégica: Gestão do Ciclo de Vida de Ativos (EAM)

O processo de reestruturação visa transformar a plataforma em um sistema robusto de **Gestão de Conformidade e Gestão de Ativos**. A ferramenta deixará de entregar apenas um "PDF apontando erros" para entregar à indústria um **Plano de Ação contínuo (PDCA - Plan, Do, Check, Act)**.

### 2.1. Mudança do Eixo Central
O eixo do sistema pivotará da "Análise" para o **"Equipamento" (O Ativo)**.
Uma Empresa (Cliente) possui vários Equipamentos. Este equipamento tem uma vida longa na fábrica e, portanto, passará por diversas vistorias, adequações mecânicas/elétricas e revalidações ao longo dos anos. 

### 2.2. Adoção do Fluxo do Josué (O Ciclo PDCA da Segurança)
Conforme idealizado, o fluxo operacional implementará estados reais para a máquina:
1.  **Avaliação Inicial:** A máquina nasce e é avaliada (Riscos, HRN).
2.  **Plano de Ação:** Se não conforme, o sistema gera tarefas executáveis (Kanban) para a manutenção da indústria corrigir, com prazos, custos e responsáveis.
3.  **Execução e Evidência:** A fábrica executa as ordens de serviço e anexa fotos de comprovação das proteções instaladas.
4.  **Revalidação:** O engenheiro aprova a adequação e recalcula o Risco Residual.
5.  **Emissão de Conformidade:** Somente após a máquina atingir o status de "Adequada", o Laudo Técnico legal é fechado.

### 2.3. Sistema Multi-Normas (Preparação para NR-10)
A reestruturação do banco de dados e da interface prevê nativamente a extensão de serviços. Estando no contexto de um Equipamento, o engenheiro poderá escolher sob qual ótica vai avaliá-lo:
*   **Módulo NR-12:** Segurança mecânica, esmagamentos, sistemas de segurança, HRN.
*   **Módulo NR-10 (Futuro):** Segurança elétrica, painéis, arco elétrico, aterramento.

## 3. Justificativas e Benefícios da Reestruturação

*   **Escalabilidade e Cross-Selling:** Permitir que o engenheiro venda novos serviços (como adequações de NR-10) para o inventário de máquinas que já está cadastrado no sistema.
*   **Retenção de Clientes:** O cliente final (Dono da Indústria) passará a usar o software diariamente para gerenciar sua equipe de manutenção, justificando cobranças recorrentes maiores pela plataforma.
*   **Padronização de Dados:** Com a criação de um "Banco de Dados de Adequação" (soluções padronizadas), o sistema poderá gerar inteligência artificial e analytics avançados ("Quais os principais problemas mecânicos do setor metalúrgico brasileiro?").
*   **Stack Tecnológica:** A consolidação em um Monorepo (Node.js no backend e Angular/Ionic no frontend e mobile) garantirá reaproveitamento brutal de código, especialmente na tipagem e regras de validação que circularão entre a API, o Painel Web e o App do Inspetor no galpão.
