# Design System e Tokens Visuais

Este documento descreve as decisões de design, cores, fontes, tokens visuais e estratégias de ícones adotadas no projeto **Normatiza v2**.

---

## 🎨 1. O Conceito de Design Tokens

O sistema de design baseia-se em **Design Tokens** (do PrimeNG v21) integrados nativamente com o **Tailwind CSS v4** via variáveis CSS.

Não escrevemos cores ou valores fixos nos arquivos. Em vez disso, todo o layout utiliza variáveis semânticas que leem os tokens injetados no formato `--p-[propriedade]`.

---

## 🚫 2. Regra de Ouro: Sem Cores Hardcoded

> [vanilla css warning]
> **NUNCA** utilize cores em formato hexadecimal/RGB (`bg-[#3b82f6]`), classes fixas do Tailwind (`bg-blue-500`, `text-emerald-600`) ou inline styles para definir cores no seu código HTML/TS.
>
> **Exceção única:** Situações extremamente específicas de dashboards/gráficos dinâmicos onde a cor seja um dado de API.

Se você precisar de uma cor, utilize as variáveis semânticas do sistema:

| Classe Tailwind | Mapeamento no PrimeNG | Função |
| :--- | :--- | :--- |
| `bg-primary` | `--p-primary-color` | Fundo com a cor primária (Tema atual) |
| `text-primary` | `--p-primary-color` | Texto com a cor primária |
| `text-primary-contrast` | `--p-primary-contrast-color` | Texto legível sobre fundo da cor primária |
| `bg-primary-hover` | `--p-primary-hover-color` | Cor primária para estados de `:hover` |
| `bg-surface-0` / `900` | `--p-surface-0` / `900` | Cor de fundo de cards e painéis (Branco no light, chumbo no dark) |
| `text-surface-700` | `--p-surface-700` | Texto secundário legível |
| `text-muted-color` | `--p-text-muted-color` | Texto de apoio/legenda (cinza suave) |
| `border-surface-200` | `--p-content-border-color` | Cor padrão de bordas |

---

## 🔤 3. Fonte do Sistema (Geist)

Adotamos a tipografia **Geist** como a fonte principal do sistema por sua alta legibilidade em interfaces de dados e design moderno.
- A fonte é importada de forma global em [styles.css](../../apps/web/src/styles.css).
- É definida no Tailwind (`--font-sans`) e no PrimeNG (`--p-font-family`).

---

## 🛠️ 4. Configuração do Preset (theme.ts)

Todas as definições globais de cores, arredondamentos e tamanhos padrão de componentes nativos do PrimeNG são configurados no arquivo [theme.ts](../../apps/web/src/app/theme.ts). 

### Estrutura do Preset Customizado:
```typescript
import { definePreset } from '@primeuix/themes';
import Aura from '@primeuix/themes/aura';

export const MyCustomPreset = definePreset(Aura, {
  semantic: {
    primary: {
      50: '{purple.50}',
      // ...
      500: '{purple.500}', // Esta será a cor padrão do "bg-primary"
    },
    borderRadius: {
      none: '0',
      xs: '0.125rem',   // 2px
      sm: '0.25rem',    // 4px
      md: '0.375rem',   // 6px
      lg: '0.5rem',     // 8px (Padrão usado pela maioria dos componentes médios do PrimeNG)
      xl: '0.75rem'     // 12px
    }
  },
  components: {
    button: {
      root: {
        // Redução global do tamanho padrão dos botões do PrimeNG
        paddingX: '0.75rem',  // Mais compacto
        paddingY: '0.375rem'
      }
    }
  }
});
```

---

## 🟢 5. Cores de Status

As cores de status (sucesso, erro, alerta, info) utilizam as paletas de cores padrão injetadas pelo tema selecionado (Aura). Elas são mapeadas de forma limpa no [styles.css](../../apps/web/src/styles.css) para expor as seguintes classes utilitárias no Tailwind:

*   **Success (Sucesso):** `bg-success` / `text-success` (Lê a variável `--p-green-500`)
*   **Danger (Erro/Perigo):** `bg-danger` / `text-danger` (Lê a variável `--p-red-500`)
*   **Warning (Alerta/Aviso):** `bg-warning` / `text-warning` (Lê a variável `--p-amber-500`)
*   **Info (Informação):** `bg-info` / `text-info` (Lê a variável `--p-blue-500`)

---

## 📋 6. Tabelas: sempre `app-data-table`

Nenhuma tela monta `p-table` por conta própria. Toda lista passa por
[`shared/components/data-table`](../../apps/web/src/app/shared/components/data-table/data-table.component.ts).

O que o componente encapsula **não é a marcação** — é a decisão sobre os três
estados que toda lista tem e que nenhuma tela lembrava de ter:

| Estado | O que aparece |
| :--- | :--- |
| **Carregando** | Barras no lugar das linhas. O desenho já mostra que ali vai nascer uma lista, e a tela não salta quando ela chega. |
| **Vazia** | Título, uma linha de apoio e — opcionalmente — a ação que resolve. |
| **Com dados** | A tabela, rolando dentro da própria caixa: a página nunca rola de lado. |

> Antes dele, as três telas mostravam zero linha em silêncio nos três casos.
> "Ainda buscando", "não existe nada" e "a requisição falhou" ficavam
> visualmente idênticos, e quem olhava não sabia se esperava, se agia, ou se o
> sistema tinha quebrado.

### Dirigido por template, nunca por configuração

```html
<app-data-table
  [dados]="membros()"
  [carregando]="carregando()"
  vazio="Sua equipe ainda está vazia."
  vazioDetalhe="Convide quem vai trabalhar com você."
>
  <ng-template appCabecalho>
    <tr><th>Nome</th><th>Papéis</th></tr>
  </ng-template>

  <ng-template appLinha [appLinhaDe]="membros()" let-membro>
    <tr><td>{{ membro.name }}</td><td>…</td></tr>
  </ng-template>

  <!-- Opcional: só aparece na tela vazia. -->
  <ng-template appAcaoVazia>
    <p-button label="Convidar a primeira pessoa" (onClick)="convidar()" />
  </ng-template>
</app-data-table>
```

**Por que não `[colunas]="[{ campo: 'name', titulo: 'Nome' }]"`:** parece mais
limpo por duas semanas, até a primeira coluna que precisa de um badge. Aí nasce
`cellTemplate`, depois `formatter`, depois `pipeArgs` — e no fim se reinventou a
sintaxe de template do Angular, pior e sem verificação de tipo, porque
`campo: 'name'` é uma string que ninguém confere.

**Por que `[appLinhaDe]` repete a mesma coleção:** é dali que o compilador tira
o tipo de `let-membro`. Sem isso ele chega como `any`, e `any` desliga a
checagem em silêncio — foi assim que um `ROLE_LABEL[papel]` indexado por `any`
passou a compilar sem aviso. É o mesmo recurso que o `ngFor` usa, pela mesma
razão.

O `p-table` continua embaixo, à vista. O que se encapsula é a decisão sobre ele,
não o acesso a ele.

> Os três estados estão lado a lado na vitrine em `/admin/design-system`.

### Agrupar, quando a lista responde melhor em blocos

Algumas listas respondem a uma pergunta que já vem em baldes. "Quem tem acesso a
esta empresa" é uma delas: consultoria, gente da própria empresa e terceiros são
**três relações contratuais diferentes**, com expectativas diferentes sobre quem
manda em quem.

```html
<app-data-table [dados]="membrosAgrupados()" agruparPor="origin">
  <ng-template appTituloDeGrupo [appTituloDeGrupoDe]="membrosAgrupados()" let-membro>
    {{ rotuloDaOrigem(membro.origin) }} · {{ quantasNaOrigem(membro.origin) }}
  </ng-template>
  …
</app-data-table>
```

Duas obrigações de quem usa:

1. **Os dados chegam já ordenados** pelo campo do agrupamento. O `p-table` abre
   um grupo a cada troca de valor — lista fora de ordem produz o mesmo título
   três vezes. A ordenação é da tela porque é decisão de apresentação.
2. **A coluna daquele campo sai.** Dentro de cada bloco ela repetiria o mesmo
   valor linha após linha, que é a definição de ruído.

> **`agruparPor` é um nome de campo em string — justo o que o componente evita
> no resto.** A razão é que quem agrupa é o `p-table`, e é assim que ele pede. A
> troca vale porque aqui a string nomeia **um** campo e falha alto (nenhum grupo
> aparece), enquanto uma configuração de colunas nomearia todas e falharia
> caladamente, célula a célula. O conteúdo do título continua sendo template,
> com tipo.

### Regra geral: o que não varia não aparece

Vale para coluna, para ação e para pergunta — e é a mesma frase nos três casos:

> Uma coluna cujo valor é igual em todas as linhas **para quem está olhando** não
> é informação, é largura gasta repetindo o que o título da tela já disse. Um
> campo com uma resposta possível não é pergunta. Uma coluna de ações sem ação
> nenhuma é cabeçalho sobre o vazio.

O recorte é sempre **quem está olhando**, e a conta é sobre as linhas **que
chegaram** — o Técnico alocado só na BRF recebe a lista já recortada pelo escopo
dele, e a coluna "Empresas" diria "BRF" da primeira à última. Para o Josué, a
mesma coluna responde a uma pergunta de verdade e fica.

Quem decide o que pode ser feito continua sendo o servidor (`actions`, D13); a
tela só pergunta se **alguma** linha tem algo a oferecer.

---

## 🧑‍🔧 7. Papéis: nunca um nome de cargo sozinho

O papel aparece como selo em quase toda tabela do sistema, e um nome de cargo
não diz o que ele alcança — "Engenheiro do Cliente" não conta a ninguém que essa
pessoa jamais toca na análise. Metade das regras deste sistema são negativas, e
eram justamente as que a interface calava.

Três textos, num lugar só — `packages/shared/src/auth/roles.ts`:

| Mapa | O que carrega |
| :--- | :--- |
| `ROLE_LABEL` | Como o papel se chama. |
| `ROLE_SUMMARY` | O que a pessoa **faz**. |
| `ROLE_LIMIT` | O que ela **não** faz. |
| `ROLE_ORDER` | A ordem de apresentação: por **alçada**, nunca alfabética. |

Lidos em três lugares, sempre os mesmos: o **convite** (para decidir), **Meu
Perfil** (para a pessoa entender o que ela é) e o **guia** `app-role-guide` — um
diálogo aberto por um link nas telas de equipe, disponível também a quem não
convida ninguém.

> **Nunca explique um papel por `title`/hover.** É o anti-padrão de prioridade 2
> da base de UX: morre no toque, onde não existe cursor, e não chega a leitor de
> tela.

### `app-role-picker`: a escolha some quando não há escolha

| Papéis que quem convida concede | A forma |
| :-: | :--- |
| **1** | Nenhum campo. O papel é **declarado**, com a descrição. |
| **vários, um lado** | Lista de opções, ordenada por alçada. |
| **vários, dois lados** | A mesma lista, com um título por lado. |

Mesma regra que já esconde o seletor de empresas dentro de uma empresa: *uma
lista de uma opção só é uma pergunta encenada*. A **descrição fica** — quem não
escolhe nada ainda precisa saber o que aquela pessoa vai enxergar.

**Não são abas.** Só o Engenheiro Responsável alcança os dois lados: a aba
existiria para uma única pessoa do sistema, e esconderia metade das opções das
demais — quem abrisse no lado errado precisaria descobrir que existe outro, e o
papel escolhido poderia ficar numa aba fechada.

O alvo de clique é o **cartão inteiro**, via `<label for>`, e não o ponto do
rádio.

---

## 🎨 8. Diretrizes para Uso de Ícones (PrimeIcons vs. Lucide)

Para manter o design limpo, consistente e de alta performance, adotamos uma estratégia híbrida para o uso de ícones:

### 1. PrimeIcons (Dinâmicos / Sem Fricção)
* **Onde usar:** Exclusivamente na **Sidebar** ou em componentes genéricos que renderizam ícones dinamicamente com base em strings simples (ex: `'pi pi-chart-bar'`).
* **Motivo:** Permite que novas telas sejam declaradas em `app.routes.ts` com ícones imediatos, sem a necessidade de importar e registrar cada SVG individualmente nos arquivos de configuração do Angular.

### 2. Lucide Icons via `ng-icons` (Premium / Sob Demanda)
* **Onde usar:** No **restante de toda a aplicação** (conteúdo das páginas, cards, botões de ação, modais, configurações, etc.).
* **Motivo:** Os ícones Lucide garantem um visual ultra-premium (estilo Vercel e Supabase), possuem suporte nativo a customizações de traço (`stroke-width`) e são importados sob demanda via *tree shaking*, não poluindo o tamanho final do build.

> [!IMPORTANT]
> Para garantir a consistência visual da interface, **sempre utilize Lucide** nas páginas internas de funcionalidades. Evite o uso de PrimeIcons fora do escopo de navegação principal (Sidebar).
