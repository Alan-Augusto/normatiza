# 04 - Arquitetura Frontend e Telas (UI & Client-Side Flow)

Este documento detalha a arquitetura da interface do usuário (UI) do sistema **Normatiza**, construída em **React (v17)**, mapeando sua árvore de componentes, fluxo de rotas, controle de estado local, persistência offline e comportamento das telas principais.

---

## 1. Stack Tecnológica e Bibliotecas Core

A interface foi projetada como um aplicativo de página única (SPA - Single Page Application) responsivo e otimizado para o preenchimento de formulários industriais em campo:

*   **Framework Base:** React v17.0.2.
*   **Roteamento:** React-Router v5.2.0 (utilizando roteamento declarativo e histórico de navegação customizado em `history.js`).
*   **Estilização:** Vanilla SASS (arquivos compilados a partir de `src/assets/sass/main.scss`) com componentes baseados em **Bootstrap v5** (`react-bootstrap`).
*   **Persistência e Cache:**
    *   `localStorage` (através do wrapper customizado `localStore` com expiração de 24h) para token de sessão e dados básicos do operador.
    *   `localForage` (baseado em IndexedDB do navegador) para armazenamento de conjuntos massivos de dados estruturados (tabelas de normas regulamentadoras, origens e consequências de perigos).
*   **Gerenciamento de Mídia:** `blueimp-load-image` para redimensionamento e compressão em tempo real de fotos capturadas pela câmera em vistorias antes do envio via API (limite de redimensionamento em canvas de 6000x6000px com qualidade JPEG 0.75).

---

## 2. Estrutura Global do Layout

O frontend possui uma divisão clara de casca (layout) controlada por dois componentes estruturais:

### 2.1 O Componente Raiz (`App.js`)
Atua como um Provider implícito usando o padrão Render Props (`childrenFn`). Ele é encarregado de:
*   Inicializar e atualizar os dados do operador logado (`operator`).
*   Carregar as tabelas de referência offline (normas e cadastros globais) via `localForage` e injetá-las na propriedade `lists`.
*   Gerenciar o estado global de caixas de diálogo e modais do sistema (`alert`, `confirm`, `prompt` e visualizações genéricas de impressão).

### 2.2 O Painel Administrativo (`Panel.js`)
Monta a casca visual da aplicação pós-login:
*   **Barra Superior (Navbar):** Informações do perfil logado, saldo de análises disponíveis, e botão de logout.
*   **Menu Lateral (Sidebar):** Renderizado de forma dinâmica com base nos privilégios do `operator.type` (escondendo links irrelevantes via filtros `hideWhen`).

---

## 3. Tabela de Rotas e Telas Mapeadas

As rotas são declaradas em `src/index.js` sob a tag `<Switch>`. Rotas internas utilizam o componente `<PrivateRoute>` que valida o estado de autenticação antes de renderizar.

### 3.1 Rotas Públicas (Fluxo de Acesso)
*   `/login/:token?`: Tela de Login. Caso receba um token na URL, inicia o fluxo de recuperação de conta.
*   `/login/confirm/:token?` e `/login/confirmEng/:token?`: Ativação e validação do e-mail do usuário/engenheiro.
*   `/registrar`: Form de auto-cadastro para novos Engenheiros (plano Trial).

### 3.2 Rotas Privadas (Internas do Painel)

| Rota (Path) | Componente Associado | Perfis Permitidos | Descrição da Tela |
| :--- | :--- | :---: | :--- |
| `/` (Home) | `EngineerDashboard` ou `HomeMessage` | Todos | Dashboard principal. Se for Engenheiro sem dados, mostra passo-a-passo onboarding e tutorial em vídeo. |
| `/clientes` | `CustomerPage` | Engineer, GuestEngineer, Analyst | Lista empresas industriais clientes do tenant corrente. |
| `/empresas` | `CustomerPage` | Manager | Lista empresas sob gerenciamento do perfil corrente. |
| `/equipe` | `UserList` | Admin, Engineer | Lista e permite convidar membros de equipe (Analistas/Gerentes). |
| `/cliente` | `UserList` | Admin | Gerenciamento global de clientes da plataforma (para faturamento). |
| `/ferramentas` | `AnalysisTools` | Engineer, GuestEngineer, Analyst | Ferramenta utilitária de cálculo rápido de HRN e consultas NR-12. |
| `/limites` | `UserLimitList` | Admin | Controle de limites de análises permitidas e liberação de licenças. |
| `/titulo` | `StandardTitleList` | Admin | Gerencia grupos de normas técnicas (ex: NR-12, NR-10). |
| `/norma` | `StandardList` | Admin | Gerencia os itens/cláusulas legais específicos das normas. |
| `/meu-perfil` | `UserForm` | Todos | Edição de informações pessoais, assinatura e alteração de senha. |
| `/meu-perfil/personalizar`| `UserConfigsReport`| Engineer (Não-Trial) | Customização estética de logotipos e cabeçalhos de relatórios. |
| `/meu-perfil/historico` | `UserConsumeHistory`| Engineer (Não-Trial) | Histórico de consumo e faturamento de laudos gerados. |
| `/cliente/cadastro` | `UserForm` | Admin, Engineer, GuestEngineer | Cadastro/Edição de dados de uma empresa cliente (endereço, CNPJ). |
| `/cliente/:id/extras` | `UserDocsList` | Engineer, GuestEngineer, Manager, Customer | Arquivos auxiliares enviados pelo/para o cliente. |
| `/cliente/inventario/:id`| `InventoryPage` | Todos (exceto Analyst) | Lista unificada de máquinas cadastradas sob o cliente. |
| `/clientes/:id/equipamentos`| `AnalysisPage` | Engineer, GuestEngineer, Analyst, Manager | Painel de controle de vistorias técnicas abertas para o cliente `:id`. |
| `/analise/cadastro` | `RiskAnalysisForm` | Engineer, GuestEngineer, Analyst | Form principal de vistoria de máquina e perigos (Passos 1, 2, 3). |
| `/estudo/cadastro` | `RiskStudiesForm` | Engineer, GuestEngineer, Analyst | Elaboração de estudo conceitual de proteções propostas. |
| `/laudo/cadastro` | `RiskTechnicalReportForm`| Engineer, GuestEngineer, Analyst | Criação de laudo técnico compilado de múltiplos equipamentos. |

---

## 4. O Fluxo do Formulário de Vistoria de Máquina (`RiskAnalysisForm`)

O processo de vistoria é o core operacional do frontend. Ele é dividido em um assistente de múltiplas etapas (Wizard) gerenciado pelo estado interno do componente:

### Etapa 1: Abertura da Análise (`AnalysisPage` / `analysis`)
O usuário seleciona o Cliente, seleciona a máquina existente no inventário (ou cadastra uma nova), informa o Engenheiro responsável e insere o número da ART de vistoria correspondente.

### Etapa 2: Cadastro Físico da Máquina (`machine1` a `machine4`)
Formulário detalhado que mapeia os dados físicos do equipamento:
*   Campos de texto para modelo, número de série, dimensões físicas e potência.
*   Checkboxes para seleção das fontes de energia instaladas.
*   Upload de 4 fotos da máquina (vistas frontal, lateral esquerda, lateral direita, superior).
*   Formulário de preenchimento dos regimes de manutenção e existência de manual técnico.

### Etapa 3: Pontos de Perigo (`risk`)
Interface para listagem e cadastro de pontos de risco da máquina:
*   **Adicionar Ponto:** Abre formulário para descrever a localização exata do perigo, selecionar foto do ponto crítico e preencher as medidas de proteção instaladas/propostas.
*   **Cálculo Dinâmico:** Seletores dropdown para escolher os níveis de **FE**, **PE**, **MPL** e **NP**. A interface recalcula o HRN em tempo real no cliente e exibe a badge com a cor correspondente (verde para Aceitável, vermelho para Alto/Inaceitável).
*   **Seleção de Normas:** Modal para pesquisar na lista off-line (`localForage`) e selecionar os itens específicos da NR-12 descumpridos por aquele ponto de risco.

### Etapa 4: Checklists PAP e PE (`pap` e `pe`)
*   **PAP:** Formulário com abas de Acionamento, Rearme e Parada. Para cada aba, existem seletores sim/não de conformidade técnica e botões de sim/não de conformidade com a NR-12, permitindo upload de foto de cada um dos botões.
*   **PE (Entropia):** Grade de botões interativos sim/não para marcar itens como "Rearme Manual", "Extrabaixa Tensão", "Autotravamento" e justificar com solução textual os pontos com desgaste.

---

## 5. Resiliência Offline e Operação Remota

Uma das regras de arquitetura essenciais implementadas no frontend do Normatiza é a resiliência offline, visto que inspeções industriais frequentemente acontecem em subsolos ou galpões sem acesso à internet:

1.  **Cache Inicial das Listas:** No momento do login online, as chamadas de API baixam todas as normas regulamentadoras cadastradas (`getList("standard")`), origens de perigo, tipos de perigo e proteções. Esses dados pesados são consolidados em um objeto JSON e gravados no IndexedDB do navegador pelo `localForage.setItem(config.LISTS_KEY, lists)`.
2.  **Consulta Local:** Quando o formulário de cadastros de riscos necessita listar normas ou sugerir consequências de lesão, ele consome a constante injetada `lists` (em memória) ao invés de bater nos endpoints da API, garantindo preenchimento instantâneo e offline.
3.  **Geração de IDs Temporários:** Para criar novos riscos e proteções na memória local da aplicação sem bater no banco, o frontend utiliza o gerador `generateId() = Math.round(Date.now() / 1000) * -1`. Os IDs temporários negativos servem para o frontend diferenciar o que é um registro novo na tela do que já existia no banco antes do salvamento definitivo.
