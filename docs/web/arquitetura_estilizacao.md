# Arquitetura de Estilização e Engenharia CSS

Este documento detalha o funcionamento técnico da engenharia de estilos, escala de unidades, e a integração entre o **Tailwind CSS v4** e o **PrimeNG v21** no projeto **Normatiza v2**.

---

## 📏 1. Padronização de Medidas: Pixel para REM

Adotamos a escala de acessibilidade padrão dos navegadores, onde **16px (tamanho de fonte base) equivale a 1rem**.

> [!IMPORTANT]
> **NUNCA** use valores em pixels (`px`) em propriedades CSS ou nos arquivos de estilo (`theme.ts`, `styles.css` ou estilos locais). Utilize sempre valores em `rem` para que a interface se adapte dinamicamente se o usuário alterar as configurações de zoom ou tamanho de fonte do sistema.

### Tabela de Conversão Rápida (Base 16px)

| Pixels (px) | REM | Uso Comum |
| :--- | :--- | :--- |
| `2px` | `0.125rem` | Borda extra-fina, border-radius xs |
| `4px` | `0.25rem` | Spacing xs, border-radius sm |
| `6px` | `0.375rem` | Spacing sm, border-radius md |
| `8px` | `0.5rem` | Spacing md, border-radius lg |
| `12px` | `0.75rem` | Spacing lg, border-radius xl |
| `16px` | `1rem` | Tamanho de texto base, spacing xl |
| `24px` | `1.5rem` | Spacing 2xl, títulos de seção, padding global de páginas |
| `32px` | `2rem` | Títulos grandes, spacing 3xl |

---

## 🌉 2. Sincronização: PrimeNG + Tailwind v4

No Tailwind v4, a integração ocorre diretamente declarando variáveis no bloco `@theme` no arquivo global de estilos [styles.css](../../apps/web/src/styles.css). Isso vincula as classes de utilidade padrão do Tailwind aos Design Tokens definidos no PrimeNG em `theme.ts`.

```css
/* Mapeamento de variáveis no styles.css */
@theme {
  /* Família de Fonte Geist */
  --font-sans: "Geist", sans-serif;

  /* 1. Mapeamento de Cores Semânticas do PrimeNG para o Tailwind */
  --color-primary: var(--p-primary-color);
  --color-primary-hover: var(--p-primary-hover-color);
  --color-primary-contrast: var(--p-primary-contrast-color);
  
  /* 2. Sincronização de Border Radius em REM */
  --radius-xs: var(--p-border-radius-xs);
  --radius-sm: var(--p-border-radius-sm);
  --radius-md: var(--p-border-radius-md);
  --radius-lg: var(--p-border-radius-lg);
  --radius-xl: var(--p-border-radius-xl);
  
  /* 3. Variáveis de Espaçamento Globais (Estruturais) */
  --spacing-layout-padding: 1.5rem; /* 24px */
  --spacing-sidebar-width: 18rem;   /* 288px */
}
```

*Com isso, classes como `rounded-lg` no Tailwind usarão automaticamente o valor dinâmico de `--p-border-radius-lg` configurado no `theme.ts`.*

---

## 🛠️ 3. Organização de Sobrescritas do PrimeNG (ex: Tooltip e Status)

Quando um componente do PrimeNG não puder ser configurado diretamente pelo `theme.ts` (ou por limitações do preset), a sobrescrita deve ser feita **no arquivo de estilos global**, mas sempre usando as **variáveis semânticas** do sistema, nunca valores manuais em pixels.

Para manter a ordem e clareza, as sobrescritas residem na camada `@layer primeng-overrides` do [styles.css](../../apps/web/src/styles.css):

```css
/* Camada dedicada para ajustes finos em componentes PrimeNG */
@layer primeng-overrides {
  :root {
    /* 1. Tipografia Global */
    --p-font-family: "Geist", sans-serif;

    /* 2. Ajuste do Tooltip usando variáveis semânticas do tema */
    --p-tooltip-border-radius: var(--p-border-radius-md);
    --p-tooltip-background: var(--p-content-color);
    --p-tooltip-color: var(--p-content-background);
  }
}
```

---

## 🌒 4. Mecanismo de Dark Mode Unificado

O Tailwind v4 está configurado no global CSS para ativar a variante `dark:` somente quando a classe `.app-dark` for adicionada ao elemento raiz:
```css
@custom-variant dark (&:where(.app-dark, .app-dark *));
```

O controle do tema é feito através do `ThemeService` injetado no componente:
* Chame `themeService.toggleTheme()` para alternar entre claro e escuro.
* Utilize a diretiva `dark:` do Tailwind combinada com as classes semânticas do PrimeNG no HTML:
  ```html
  <div class="bg-surface-0 dark:bg-surface-900 border border-surface-200 dark:border-surface-800"></div>
  ```
