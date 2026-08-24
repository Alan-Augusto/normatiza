# Arquitetura e Organização do Frontend

Este documento descreve a organização do código, a divisão de responsabilidades e as diretrizes arquiteturais para o frontend da aplicação **Normatiza v2** (Angular v22).

---

## 1. Visão Geral do Monorepo

O projeto é estruturado como um monorepo gerenciado por **pnpm**:
*   `apps/web`: Nossa aplicação principal em Angular (Single Page Application).
*   `packages/shared`: Pacote compartilhado de utilitários TypeScript, DTOs e interfaces de dados comuns.

---

## 2. Regra Geral de Componentização

**É obrigatório separar a lógica, o template e a estilização em arquivos dedicados.** 
Não utilize templates ou estilos inline dentro do decorador `@Component`. Qualquer componente criado deve possuir exatamente 3 arquivos principais:

1.  `[nome].component.ts`: Contendo a classe, controle de estado, injeção de dependências e importações.
2.  `[nome].component.html`: Contendo a estrutura e marcação HTML.
3.  `[nome].component.css` (ou `.scss`): Contendo as regras de estilos CSS exclusivas do componente.

```typescript
// Exemplo correto de declaração no TS
import { Component } from '@angular/core';

@Component({
  selector: 'app-exemplo',
  standalone: true,
  imports: [],
  templateUrl: './exemplo.component.html',
  styleUrl: './exemplo.component.css'
})
export class ExemploComponent {}
```

---

## 3. Estrutura de Pastas do App (`apps/web/src/app`)

A pasta de features **espelha os contextos de navegação** definidos em [docs/produto/03 — Navegação e Telas](../produto/03_navegacao_e_telas.md). Essa correspondência é intencional: se uma tela existe num contexto no produto, ela mora na pasta daquele contexto no código.

```
src/app/
├── core/                           # Inteligência global e Singletons
│   ├── guards/                     # Guardas de rota: autenticação, papel e escopo
│   ├── interceptors/               # Interceptadores HTTP (token, tratamento de erros)
│   └── services/                   # Serviços globais (auth, contexto ativo, permissões)
│
├── shared/                         # Utilitários visuais e genéricos compartilhados
│   ├── components/                 # Componentes genéricos de UI
│   └── services/                   # Serviços transversais (ex: theme.service.ts)
│
└── features/                       # CONTEXTOS E FUNCIONALIDADES DO NEGÓCIO
    ├── public/                     # --- Área pública ---
    │   ├── public.layout.ts        # Layout da área pública
    │   ├── landing/                # Página institucional
    │   └── auth/                   # Login, convite e definição de senha
    │
    ├── admin/                      # --- Contexto 0: backoffice da plataforma ---
    │   ├── admin.layout.ts
    │   ├── accounts/               # Contas (consultorias)
    │   └── catalogs/               # Catálogos globais e tabelas HRN versionadas
    │
    ├── consultancy/                # --- Contexto 1: visão geral da consultoria ---
    │   ├── consultancy.layout.ts
    │   ├── dashboard/              # Dashboard geral e filas de trabalho
    │   ├── companies/              # Carteira de empresas atendidas
    │   ├── team/                   # Equipe, convites e desligamento com sucessão
    │   ├── catalogs/               # Meus Cadastros (soluções, modelos)
    │   └── reports/                # Relatórios gerenciais
    │
    ├── company/                    # --- Contexto 2: empresa ---
    │   ├── company.layout.ts       # Cabeçalho com a empresa em contexto
    │   ├── dashboard/
    │   ├── sectors/
    │   ├── action-plan/            # Plano de ação consolidado
    │   ├── price-table/            # Tabela de preços e fornecedores
    │   ├── team/                   # Equipe da empresa
    │   ├── files/
    │   └── equipments/             # Inventário
    │       └── equipment/          # --- Contexto 3: equipamento ---
    │           ├── equipment.layout.ts
    │           ├── dashboard/
    │           ├── analysis/       # Assistente de análise (4 etapas)
    │           ├── studies/
    │           ├── action-plan/
    │           ├── reports/        # Laudos
    │           └── history/
    │
    └── execution/                  # --- Área de Execução: transversal ---
        └── my-tasks/               # Tela inicial e única do Executor
```

> [!IMPORTANT]
> **Guardas de rota não bastam.** O escopo e a etapa de cada item são validados no servidor. As guardas existem para não exibir ao usuário caminhos que ele não pode percorrer, nunca como mecanismo de segurança. Ver [docs/produto/01 — Papéis e Permissões](../produto/01_papeis_e_permissoes.md).

---

## 4. Anatomy of a Context (Feature)

Cada contexto funcional (por exemplo, `features/app/profile`) deve seguir uma estrutura interna padronizada para manter a coesão do código. 

### O que DEVE e NÃO DEVE ter dentro de um contexto:

*   ✅ **`[nome].component.ts` / `.html` / `.css`**: Os arquivos separados da página/componente raiz do contexto.
*   ✅ **`components/`**: Subcomponentes específicos e exclusivos deste contexto. Cada subcomponente aqui deve possuir seus arquivos `.ts`, `.html` e `.css` separados.
*   ✅ **`services/`**: Serviços que manipulam exclusivamente dados deste contexto.
*   ✅ **`mocks/`**: Dados mockados para testes unitários ou simulação local.
*   ❌ **`interfaces/` ou `models/` (LOCAIS)**: **Não** criar localmente. Todas as interfaces de dados que trafegam na rede devem ser declaradas no pacote global `@normatiza/shared` no packages global do monorepo para garantir reuso.

### Exemplo visual de um contexto:
```
features/app/profile/
├── profile.component.ts        # Lógica do componente
├── profile.component.html      # Template HTML
├── profile.component.css       # Estilo CSS
├── components/                 # Componentes específicos (Ex: profile-avatar)
├── services/                   # Serviços específicos do contexto
└── mocks/                      # Mocks de dados para testes
```

---

## 5. Padrão de Layout e Cabeçalhos

Para manter a consistência visual e evitar código redundante nas telas individuais:

### 5.1. Paddings no Container Principal
O wrapper do layout já aplica automaticamente o espaçamento padrão na tag `<main>` onde as páginas são renderizadas.

**Regra:** o HTML de componentes de página **nunca** deve conter classes de padding ou largura máxima raiz (ex: `p-6` ou `max-w-7xl mx-auto`). Os elementos começam diretamente no fluxo estrutural do layout.

### 5.2. Títulos e Subtítulos Dinâmicos
O título (`h1`) e o subtítulo (`p`) de cada tela são gerenciados de forma centralizada pelo layout, que lê as propriedades `label` e `subtitle` do objeto `data` da rota ativa.

**Regra:** não crie elementos locais de título e subtítulo dentro das telas. Configure-os na declaração da rota:

```typescript
{
  path: 'minha-tela',
  loadComponent: () => import('./...'),
  data: {
    label: 'Minha Tela',
    icon: 'pi pi-check',
    subtitle: 'Esta descrição aparecerá no topo sob o título.'
  }
}
```

### 5.3. Cabeçalho de Contexto
Nos Contextos 2 e 3, o usuário precisa saber permanentemente **em qual empresa e em qual equipamento** está atuando — é a premissa central de UX do produto.

Esse identificador é responsabilidade do **layout do contexto** (`company.layout.ts`, `equipment.layout.ts`), que o resolve a partir dos parâmetros da rota e o exibe acima do título da tela. Ele coexiste com o título dinâmico da §5.2, sem substituí-lo.

**Regra:** telas individuais **não** renderizam o nome da empresa ou do equipamento como cabeçalho próprio. Consomem o contexto ativo pelo serviço correspondente em `core/services`.

