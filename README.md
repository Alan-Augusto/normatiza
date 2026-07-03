# Normatiza v2 - Monorepo

Este é o repositório central do projeto **Normatiza v2**, organizado no modelo Monorepo utilizando **PNPM Workspaces**. A resolução e consumo do pacote de contratos compartilhados é feita em tempo de execução via **TypeScript Paths** (mapeamento de caminhos no tsconfig), dispensando etapas prévias de compilação.

---

## 📂 Estrutura de Pastas

```text
├── apps/
│   ├── api/          # Backend (NestJS + Prisma + MySQL)
│   ├── web/          # Frontend Web Desktop (Angular + PrimeNG)
│   └── mobile/       # Aplicativo Móvel Campo (Angular + Ionic + Capacitor)
├── packages/
│   └── shared/       # Contratos Compartilhados (TypeScript puro, 0 dependências)
├── package.json      # Scripts e orquestração do monorepo
├── pnpm-workspace.yaml # Definição dos workspaces pnpm
└── tsconfig.json     # Resolução global dos TS Paths para o pacote shared
```

### Detalhes das Stacks
*   **[shared](file:///Users/alan-augusto/DEV/BRWORKS/normatiza_v2/packages/shared)**: Contém interfaces, DTOs e funções utilitárias puras. Restrição absoluta de zero dependências em runtime para consumo imediato.
*   **[api](file:///Users/alan-augusto/DEV/BRWORKS/normatiza_v2/apps/api)**: API REST que serve a aplicação. Configurada com suporte ao **Prisma ORM** conectando a uma base **MySQL**, utilizando compilação via **Webpack** para manter a estrutura de build plana.
*   **[web](file:///Users/alan-augusto/DEV/BRWORKS/normatiza_v2/apps/web)**: Painel administrativo focado em ambiente Desktop rodando sobre Angular e componentes PrimeNG.
*   **[mobile](file:///Users/alan-augusto/DEV/BRWORKS/normatiza_v2/apps/mobile)**: Aplicação móvel focada em trabalho em campo com suporte a fluxos offline e banco local de dados.

---

## 🛠️ Pré-requisitos

Para trabalhar neste projeto, você precisará de:
*   [Node.js](https://nodejs.org/) (recomendada a versão LTS v20+)
*   [pnpm](https://pnpm.io/) (instalado globalmente)
    ```bash
    npm install -g pnpm
    ```

---

## 🚀 Comandos Úteis

Todos os comandos de gerenciamento do Monorepo devem ser executados na **pasta raiz** do projeto.

### 📦 Instalação e Inicialização
Instala e vincula as dependências de todas as aplicações e pacotes compartilhados:
```bash
pnpm install
```

### 💻 Modo de Desenvolvimento (Local)
Cada aplicação pode ser executada de forma independente a partir da raiz:

```bash
# Executa apenas a API (NestJS) em modo watch
pnpm dev:api

# Executa apenas o painel Web (Angular + PrimeNG)
pnpm dev:web

# Executa apenas o App Mobile (Ionic + Capacitor)
pnpm dev:mobile
```

### 🏗️ Compilação (Build)
Compila as três aplicações do monorepo sequencialmente de forma compatível com Windows, macOS e Linux:
```bash
pnpm build:all
```

### 🗄️ Banco de Dados (Prisma & MySQL)
Comandos orquestrados para gerenciar o banco de dados do backend:

```bash
# Baixa e atualiza a estrutura do banco MySQL existente para o schema.prisma (Database-First)
# Execute após configurar sua variável DATABASE_URL no arquivo apps/api/.env
pnpm --filter api prisma db pull

# Gera os tipos atualizados do cliente Prisma baseados no schema.prisma
pnpm prisma:generate

# Cria e aplica migrações de banco (se aplicável ao ambiente de desenvolvimento)
pnpm prisma:migrate
```

---

## 🛡️ Desenvolvimento Multiplataforma

Os scripts presentes no `package.json` foram projetados para serem compatíveis com terminais do Windows (PowerShell/CMD) e Unix (Linux/macOS), evitando o uso de comandos restritos a sistemas operacionais específicos.
# normatiza
