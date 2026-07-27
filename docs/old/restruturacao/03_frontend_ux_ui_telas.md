# UX e Detalhamento Estrutural de Telas (Frontend)

Este documento dita as regras de negócio focadas na Experiência do Usuário (UX) e especifica, componente a componente, o que imaginamos para dentro de cada uma das telas projetadas para a plataforma, seguindo a hierarquia do ciclo de vida de ativos.

---

## 1. O Conceito de "Menu Contextual Dinâmico"

A premissa UX mais importante da nova plataforma é **reduzir a sobrecarga cognitiva**. 
A navegação lateral (Sidebar) se adapta completamente de acordo com o nível em que o usuário se aprofunda. Você nunca verá dados de uma máquina solta enquanto tenta olhar o dashboard financeiro da consultoria. O menu é uma âncora que delimita em qual universo você está atuando no momento.

---

## 2. NÍVEL 1: Contexto Global (A Visão Macro da Consultoria)
*Escopo: Engloba todos os clientes, sem filtro.*

### 2.1. Tela: Dashboard Geral
**Objetivo:** Dar ao gestor da consultoria uma visão panorâmica da saúde do seu negócio e de seus clientes.
**Estrutura de Dados e Componentes Visuais:**
*   **Métricas Superiores (KPIs):** Cards indicando: Total de Empresas Ativas, Total de Equipamentos Cadastrados na base, Vistorias Realizadas (Mês Atual vs. Anterior), e Total de Tarefas Pendentes somando todos os clientes.
*   **Gráfico de Evolução:** Um gráfico de linha mostrando o crescimento da base de laudos emitidos e adequações concluídas ao longo do ano.
*   **Tabela de Alertas de Vencimento:** Uma tabela vitalícia que grita atenção. 
    *   *Colunas:* Cliente, Equipamento, Data de Vencimento do Laudo, Botão de Ação Direta ("Agendar Revisão").
*   **Ranking de Risco:** As 5 empresas da carteira com o pior "Health Score" (Índice de Conformidade), permitindo ao dono da consultoria ligar para o cliente e ofertar serviços.

### 2.2. Tela: Carteira de Clientes (Minhas Empresas)
**Objetivo:** Gerenciar o acesso rápido aos espaços isolados de cada indústria.
**Estrutura de Dados e Componentes Visuais:**
*   **Barra de Ferramentas Superior:** Campo de busca rápida (por CNPJ ou Razão Social), botão "Adicionar Nova Empresa".
*   **Tabela de Clientes:**
    *   *Colunas:* Logo/Razão Social, CNPJ, Cidade/Estado, Total de Máquinas, Status (Ativo/Inativo), Ação ("Entrar na Empresa").
*   **UX Crítico:** Ao clicar em "Entrar na Empresa", ocorre uma animação de "Mergulho". O menu lateral muda, o header adota o nome do cliente. O contexto Global é deixado para trás.

### 2.3. Tela: Banco de Soluções Padrão
**Objetivo:** Administrar o catálogo de regras que alimentará os Planos de Ação (Kanban) dos clientes.
**Estrutura de Dados e Componentes Visuais:**
*   **Categorias:** Listagem agrupável (ex: "Sistemas Elétricos", "Barreiras Físicas").
*   **Itens do Catálogo:** Formulário para cadastrar uma solução (ex: Título: "Instalar Cortina de Luz", Categoria: Eletrônico, Descrição Técnica, Referência Normativa).

---

## 3. NÍVEL 2: Contexto da Empresa (A Visão do Chão de Fábrica)
*Escopo: Tudo aqui dentro diz respeito SOMENTE à indústria selecionada (Ex: Indústria XPTO).*

### 3.1. Tela: Dashboard da Empresa
**Objetivo:** O que o diretor da fábrica vai olhar ao entrar no seu sistema. Provar o valor do seu software.
**Estrutura de Dados e Componentes Visuais:**
*   **Métrica de Destaque (Hero Metric):** Um grande gauge (marcador estilo painel de carro) indicando o *Score de Conformidade* (Ex: 85% de segurança).
*   **Distribuição de Risco (NR-12):** Gráfico de barras horizontais indicando a volumetria de máquinas por faixa de HRN (Ex: 2 Máquinas Extremo, 15 Risco Alto, 50 Risco Baixo).
*   **Resumo do Kanban:** Cards contadores indicando o andamento da equipe de manutenção: Tarefas a Fazer, Em Execução, Atrasadas, Aguardando Revalidação.
*   **Lista de Top Máquinas Críticas:** O calcanhar de aquiles da fábrica listado diretamente: Nome da Máquina, Setor em que está e o Valor Numérico de Risco.

### 3.2. Tela: Inventário de Máquinas
**Objetivo:** Permitir a busca eficiente e o gerenciamento amplo do parque fabril.
**Estrutura de Dados e Componentes Visuais:**
*   **Visualização Alternável:** Toggle (botão de alternância) no topo direito para escolher:
    *   *Modo Tabela:* Colunas (Tag/Patrimônio, Nome, Setor, Status Legal, Última Auditoria). Focado em escaneabilidade de dados massivos.
    *   *Modo Cards:* Focado em imagens. Blocos exibindo a foto frontal da máquina, patrimônio e um indicador visual rápido (Conforme/Não Conforme).
*   **Filtros Contextuais:** Filtros em dropdown para segmentar (Ex: Listar apenas máquinas do Setor "Usinagem" que estejam "Não Conformes").

### 3.3. Tela: O Plano de Ação / Kanban
**Objetivo:** Transformar apontamentos de risco em um sistema vivo de execução (PDCA).
**Estrutura de Dados e Componentes Visuais:**
*   **Board Kanban:** Colunas fixas (A Fazer, Em Execução, Atrasado, Revalidação Pendente, Concluído).
*   **O Cartão de Tarefa (Card):**
    *   *Cabeçalho:* Máquina Origem (Guilhotina 02).
    *   *Corpo:* A Solução exigida (Instalar Barreira Ótica), O risco associado e uma miniatura da foto do problema.
    *   *Rodapé:* Responsável da fábrica e Data Limite.
*   **UX Crítico - Validação de Processo:** Quando a equipe de manutenção arrasta a tarefa para "Revalidação Pendente", o sistema bloqueia o card e abre um modal de formulário obrigatório. O funcionário precisa preencher: Custo da adequação, Quem assinou a obra e fazer o **Upload da foto evidenciando a melhoria**. Sem isso, a tarefa não avança.

---

## 4. NÍVEL 3: Contexto do Equipamento (A Visão da Máquina Única)
*Escopo: Você clicou em uma "Prensa". Tudo nesta tela diz respeito apenas a este equipamento.*

### 4.1. Tela: Prontuário do Equipamento
**Objetivo:** O painel de controle e a identidade ("RG") do ativo.
**Estrutura de Dados e Componentes Visuais:**
*   **Header Dinâmico:** Nome da máquina e Botões de Ação Principal ("Iniciar Vistoria NR-12").
*   **Bloco de Informações Técnicas:** Campos descritivos divididos por sessões: Dados de Fabricação (Modelo, Ano, Patrimônio), Dimensões e Operação (Capacidade, Operadores, Limites de máquina) e Fontes de Energia (Checkboxes de elétrica, mecânica, pneumática).
*   **Galeria de Imagens:** As 4 fotos padrão de reconhecimento do equipamento, expansíveis ao clique.

### 4.2. Tela: Linha do Tempo (Diário de Bordo)
**Objetivo:** O histórico legal e inquestionável de manutenções e inspeções para auditoria (Ministério do Trabalho).
**Estrutura de Dados e Componentes Visuais:**
*   **Eixo Vertical Central:** Eventos dispostos sequencialmente de cima para baixo.
*   **Blocos de Eventos:**
    *   *Data/Hora/Autor* no topo do bloco.
    *   *Tipo de Evento:* "Inspeção NR-12 Criada", "Manutenção Executada (Instalação de Botoeira)", "Laudo Emitido".
    *   *Anexos:* Se o evento for a emissão de um laudo, haverá o link direto para download do PDF ali mesmo.

### 4.3. Tela: A Vistoria Ativa (O Wizard da NR-12)
**Objetivo:** A interface pesada de trabalho do engenheiro. Feita em formato *Wizard* (Passo a Passo) para garantir que nenhuma etapa normativa seja pulada.
**Estrutura de Dados e Componentes Visuais:**
*   **Navegador Superior:** Abas indicando progresso (Inventário -> Apreciação HRN -> PAP -> PE -> Revalidação -> Fechamento).
*   **Subtela de Apreciação HRN:**
    *   Botão contínuo de "Adicionar Perigo".
    *   Para cada perigo, um formulário contendo: Qual é a Zona de Risco, Foto Específica do Ponto, Campos Select para FE, PE, MPL, NP (com o sistema calculando a pontuação e exibindo na hora na tela) e a Seleção da Solução do Kanban.
*   **Subtela de Checklists (PAP/PE):**
    *   Listagem de requisitos legais. Para cada um: Botões rádio (Sim/Não/NA).
    *   *UX Crítico:* Se o engenheiro marcar "Não" em um quesito (Ex: Falta botão de emergência), um campo de texto abre automaticamente exigindo justificativa.
*   **Subtela de Revalidação (Condicional):** Esta aba só se torna editável se o Kanban desta máquina estiver com todas as tarefas concluídas. O engenheiro abre, revisa as fotos de evidência enviadas pela manutenção, e preenche os cálculos de HRN Residual.
*   **Subtela de Fechamento:** Botão de emissão final que trava a edição de todos os formulários anteriores para garantir a inviolabilidade do Laudo (compliance).

---

## 5. Ferramentas Globais (Onipresente)

### 5.1. Busca Global "Omni-Search"
**Objetivo:** Prover navegação ultrarrápida, permitindo alcançar qualquer nível da arquitetura em 2 segundos.
**Estrutura de Dados e Componentes Visuais:**
*   **Acesso Imediato:** Campo de busca permanente no cabeçalho.
*   **Dropdown Categorizado Automático:** Ao digitar "Prensa", a caixa de resultados se divide em seções claras:
    *   *Máquinas:* Prensa 01 (Indústria X), Prensa 02 (Indústria Y).
    *   *Laudos Anteriores:* Laudo Final Prensa 01 - 2023.pdf.
    *   *Tarefas:* Instalar relé na Prensa 01.
*   *Comportamento:* Clicar num resultado quebra o contexto atual e leva o usuário direto para o Nível 2 ou Nível 3 exato onde aquele dado existe.
