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

A pasta de features **espelha a hierarquia do domínio**, que é a mesma dos contextos de navegação definidos em [docs/produto/03 — Navegação e Telas](../produto/03_navegacao_e_telas.md) e a mesma da URL: uma consultoria tem empresas, uma empresa tem equipamentos, um equipamento tem pontos de risco. A pasta aninha do mesmo jeito.

**A regra é uma só, aplicada em todos os níveis:** a *lista* de uma coleção fica na raiz da pasta dela; o *contexto de um item* fica numa subpasta no singular.

| Nível | Rota | Arquivo |
| :--- | :--- | :--- |
| Lista de empresas | `/app/companies` | `app/companies/companies.component.ts` |
| Contexto de uma empresa | `/app/companies/:companyId` | `app/companies/company/` |
| Lista de equipamentos | `/app/companies/:companyId/equipments` | `app/companies/company/equipments/equipments.component.ts` |
| Contexto de um equipamento | `.../equipments/:equipmentId` | `app/companies/company/equipments/equipment/` |

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
└── features/
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
    └── app/                        # --- Área autenticada (o esqueleto do sistema) ---
        ├── app.layout.ts           # Shell privado: sidebar, busca e cabeçalhos
        │
        │                           # Contexto 1 — Consultoria (visão geral)
        ├── dashboard/              # Dashboard geral e filas de trabalho
        ├── team/                   # Equipe, convites e desligamento com sucessão
        ├── catalogs/               # Meus Cadastros (soluções, modelos)
        ├── reports/                # Relatórios gerenciais
        ├── profile/                # Perfil do usuário — transversal, sem contexto
        ├── my-tasks/               # Área de Execução — transversal
        │
        └── companies/              # Carteira de empresas atendidas (lista)
            ├── companies.component.ts
            └── company/            # --- Contexto 2: uma empresa ---
                ├── company.layout.ts     # Resolve a empresa em contexto
                ├── dashboard/
                ├── sectors/
                ├── action-plan/          # Plano de ação consolidado
                ├── price-table/          # Tabela de preços e fornecedores
                ├── team/                 # Equipe da empresa
                ├── files/
                └── equipments/           # Inventário da planta (lista)
                    ├── equipments.component.ts
                    └── equipment/  # --- Contexto 3: um equipamento ---
                        ├── equipment.layout.ts
                        ├── dashboard/
                        ├── analysis/     # Assistente de análise (4 etapas)
                        ├── studies/
                        ├── action-plan/  # Cartões dos pontos de risco
                        ├── reports/      # Laudos
                        └── history/
```

> [!NOTE]
> **O ponto de risco não é um nível de pasta.** Ele é o cartão dentro do plano de ação ([03 §5.4](../produto/03_navegacao_e_telas.md)) — não tem rota, não tem menu e não muda o contexto. Vive em `action-plan/components/`. A hierarquia de *dados* desce até o ponto; a de *navegação* para no equipamento.

> [!NOTE]
> **A tela do Contexto 2 é compartilhada.** A consultoria chega nela clicando numa empresa da carteira; o Gestor e o Engenheiro do Cliente entram direto nela, e nunca enxergam o Contexto 1. É a mesma tela para os dois lados — o que muda é o escopo dos dados e as permissões, nunca o componente. Por isso a área autenticada se chama `app/` e não `consultancy/`: a pasta não pertence a lado nenhum.

### Imports entre áreas

O aninhamento profundo não deve virar `../../../../../..`. Use os aliases declarados em `apps/web/tsconfig.json`:

| Alias | Aponta para |
| :--- | :--- |
| `@core/*` | `src/app/core/*` |
| `@shared/*` | `src/app/shared/*` |
| `@features/*` | `src/app/features/*` |
| `@normatiza/shared` | contratos e DTOs do monorepo |

Caminho relativo (`./`, `../`) só **dentro** da mesma feature.

> [!IMPORTANT]
> **Guardas de rota não bastam.** O escopo e a etapa de cada item são validados no servidor. As guardas existem para não exibir ao usuário caminhos que ele não pode percorrer, nunca como mecanismo de segurança. Ver [docs/produto/01 — Papéis e Permissões](../produto/01_papeis_e_permissoes.md).

---

## 4. Anatomy of a Context (Feature)

Cada feature (por exemplo, `features/app/companies/company/files`) deve seguir uma estrutura interna padronizada para manter a coesão do código. 

### O que DEVE e NÃO DEVE ter dentro de um contexto:

*   ✅ **`[nome].component.ts` / `.html` / `.css`**: Os arquivos separados da página/componente raiz do contexto.
*   ✅ **`components/`**: Subcomponentes específicos e exclusivos deste contexto. Cada subcomponente aqui deve possuir seus arquivos `.ts`, `.html` e `.css` separados.
*   ✅ **`services/`**: Serviços que manipulam exclusivamente dados deste contexto.
*   ✅ **`mocks/`**: Dados mockados para testes unitários ou simulação local.
*   ❌ **`interfaces/` ou `models/` (LOCAIS)**: **Não** criar localmente. Todas as interfaces de dados que trafegam na rede devem ser declaradas no pacote global `@normatiza/shared` no packages global do monorepo para garantir reuso.

### Exemplo visual de um contexto:
```
features/app/companies/company/files/
├── files.component.ts          # Lógica do componente
├── files.component.html        # Template HTML
├── files.component.css         # Estilo CSS
├── components/                 # Componentes específicos (Ex: file-upload-dialog)
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

Quem **resolve** o identificador é o **layout do contexto** (`company.layout.ts`, `equipment.layout.ts`), a partir dos parâmetros da rota; o nome sai da sessão, não de um `GET` — `auth.companyInScope()`. Quem o **exibe** é a sidebar, logo abaixo da busca.

**Por que na sidebar, e não acima do título da tela.** O rótulo nomeia o **menu**, não o conteúdo: todo item ao lado dele já é daquela empresa (`/app/companies/:id/…`), e a saída dela — "Voltar para Empresas" — mora ali do lado. Acima do `<h1>` ele repetia a migalha, que diz a mesma coisa e ainda é clicável, e empurrava o título da tela para baixo por informação que não é da tela.

Empresa e equipamento vão em **duas linhas**, e não numa frase só: em 15rem de sidebar, *"BRF · Prensa excêntrica 60t"* trunca no meio do nome da máquina. Colapsada, a sidebar **não** mostra o contexto: é texto sem ícone, e sem largura para o texto não há o que exibir — o bloco fecha inteiro em vez de deixar um vão.

**Quem publica também apaga.** Cada layout limpa o que publicou ao ser destruído (`DestroyRef.onDestroy`); sem isso o contexto sobrevive à saída, e quem volta para a carteira segue lendo o nome da empresa numa tela que não é de empresa nenhuma. Sair da empresa leva o equipamento junto — não existe máquina sem a planta dela —, e sair da máquina preserva a empresa.

Os dois blocos — o de contexto e o de voltar — **abrem e fecham por altura** (`.revela`, em `sidebar.component.css`), porque nascem e somem conforme a pessoa entra e sai de uma empresa, e apareciam num salto. O conteúdo fica montado com a altura em zero: com um `@if` por dentro, ele sumiria antes da transição e o fechamento seria seco. Escondido, sai do foco e do leitor de tela; e quem pede `prefers-reduced-motion` recebe a mesma informação sem a transição.

**Regra:** telas individuais **não** renderizam o nome da empresa ou do equipamento como cabeçalho próprio. Consomem o contexto ativo pelo serviço correspondente em `core/services`.

