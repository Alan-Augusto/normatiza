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

O diretório principal está estruturado da seguinte forma:

```
src/app/
├── core/                           # Inteligência global e Singletons (Core Module)
│   ├── guards/                     # Guardas de rotas (Ex: auth.guard.ts)
│   ├── interceptors/               # Interceptadores HTTP (tokens, tratamento de erros)
│   └── services/                   # Serviços globais essenciais (Ex: auth.service.ts)
│
├── shared/                         # Utilitários visuais e genéricos compartilhados
│   ├── components/                 # Componentes genéricos de UI (Ex: botões customizados)
│   └── services/                   # Serviços transversais do frontend (Ex: theme.service.ts)
│
└── features/                       # CONTEXTOS E FUNCIONALIDADES DO NEGÓCIO
    ├── public/                     # --- Contextos Públicos ---
    │   ├── public.layout.ts        # Layout padrão da área pública (Landing, login)
    │   ├── landing/                # Página institucional (Landing Page)
    │   └── auth/                   # Telas de login e cadastro
    │
    ├── app/                        # --- Contextos Privados da Aplicação ---
    │   ├── app.layout.ts           # Layout interno padrão (Sidebar + Header)
    │   ├── dashboard/              # Painel principal do usuário
    │   └── profile/                # Edição de perfil do usuário logado
    │
    └── admin/                      # --- Contextos Administrativos ---
        ├── admin.layout.ts         # Layout administrativo
        └── accounts/               # Gerenciamento de contas e usuários
```

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

## 5. Padrão de Layout e Cabeçalhos (Header & Padding)

Para manter a consistência visual e evitar código redundante nas telas individuais:

1. **Paddings no Container Principal:**
   - O wrapper do layout geral (`SidebarComponent` em `apps/web/src/app/shared/components/sidebar/`) já aplica automaticamente o espaçamento padrão (`p-6 md:p-8`) na tag `<main>` onde as páginas são renderizadas.
   - **Regra:** O HTML de componentes de página **nunca** deve conter classes de padding ou largura máxima raiz (ex: `p-6` ou `max-w-7xl mx-auto`). Os elementos devem começar diretamente no fluxo estrutural do layout.

2. **Títulos e Subtítulos Dinâmicos:**
   - O cabeçalho de título (`h1`) e subtítulo (`p`) de cada tela é gerenciado de forma centralizada pelo layout da sidebar. Ele lê dinamicamente as propriedades `label` e `subtitle` do objeto `data` da rota ativa em `app.routes.ts`.
   - **Regra:** Não crie elementos locais de título e subtítulo dentro das telas. Configure-os na declaração da rota:
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

