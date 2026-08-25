# Roteiro de Implementação de Telas e Fluxos (Frontend)

Este guia serve como um passo a passo (checklist) prático que desenvolvedores e agentes de IA devem seguir ao implementar novas telas, páginas ou fluxos completos no frontend da aplicação.

---

## 🛠️ Passo a Passo para Criar uma Nova Tela

Siga esta sequência lógica ao receber uma demanda para criar uma nova tela (exemplo: criar o repositório de arquivos da empresa, no Contexto 2):

### Passo 0: Confirmar a Regra de Negócio
Antes de criar qualquer arquivo, localize a tela em **[docs/produto/03 — Navegação e Telas](../produto/03_navegacao_e_telas.md)** e confirme:
- Em qual **contexto** ela vive (0, 1, 2, 3 ou Execução) — isso define a pasta e a rota.
- Quais **papéis** a acessam e o que cada um pode fazer nela ([01 — Papéis e Permissões](../produto/01_papeis_e_permissoes.md)).
- Se a tela depende de alguma **decisão em aberto** ([06 — Pendências](../produto/06_pendencias.md)). Se depender, resolva antes — não decida no código.

### Passo 1: Criar a Estrutura de Pastas da Feature
Crie as pastas necessárias dentro da feature correspondente (seguindo as regras de contexto de **[docs/web/arquitetura.md](./arquitetura.md)**):
```bash
mkdir -p apps/web/src/app/features/app/companies/company/files/components
mkdir -p apps/web/src/app/features/app/companies/company/files/services
mkdir -p apps/web/src/app/features/app/companies/company/files/mocks
```

### Passo 2: Criar os Componentes com Arquivos Separados
Crie os arquivos TS, HTML e CSS obrigatórios para o componente principal. 
```bash
# Se usar Angular CLI (com schematics configurado para SCSS/CSS)
ng g c features/app/companies/company/files --skip-tests
```
> [!IMPORTANT]
> Garanta que o decorador `@Component` no arquivo `.ts` aponte para arquivos externos:
> ```typescript
> @Component({
>   selector: 'app-company-files',
>   standalone: true,
>   imports: [CommonModule, RouterOutlet],
>   templateUrl: './files.component.html',
>   styleUrl: './files.component.css' // ou .scss se configurado
> })
> ```

### Passo 3: Registrar Rota com Lazy Loading
No arquivo [app.routes.ts](../../apps/web/src/app/app.routes.ts), adicione a nova rota dentro do contexto correto (no exemplo, entre os filhos de `companies/:companyId`), sempre com `label` e `subtitle`:
```typescript
{
  path: 'files',
  loadComponent: () => import('./features/app/companies/company/files/files.component').then(m => m.FilesComponent),
  data: {
    label: 'Arquivos da Empresa',
    icon: 'pi pi-folder',
    subtitle: 'Documentação da planta, com categoria, validade e visibilidade por lado.'
  }
}
```

### Passo 4: Conectar à API com Serviços Locais
Se a tela consome uma API dedicada a esta feature, crie um serviço local dentro da pasta `services/` da feature:
```bash
# Exemplo: files.service.ts
```
* Use `inject(HttpClient)` para requisições.
* **Nunca** declare interfaces locais de API. Importe os DTOs e interfaces diretamente do pacote `@normatiza/shared`.

---

## 🎨 Checklist Visual e Boas Práticas

Antes de finalizar e enviar a tela para revisão (Pull Request), valide os seguintes pontos:

### 1. Cores e Tema
- [ ] O componente se comporta corretamente no Dark Mode (`dark:`)?
- [ ] Há alguma cor em formato hexadecimal (`#fff`, `rgb(...)`) ou classe estática de cor (`bg-blue-500`) no código HTML? *(Se sim, substitua pelos tokens semânticos, ex: `bg-primary`, `bg-surface-0`).*

### 2. Medidas e Espaçamentos
- [ ] Todas as margens, paddings, alturas e larguras estão utilizando `rem` (ou a escala numérica do Tailwind)?
- [ ] Existe algum valor em pixel (`px`) de estilo em linha (`style="..."`) ou nos arquivos CSS? *(Substitua por `rem` ou classes utilitárias).*
- [ ] O HTML da página **não** contém padding raiz (como `p-6` ou `p-layout-padding`) nem cabeçalhos locais (`h1`, `p`) de título/subtítulo.
- [ ] A rota correspondente no `app.routes.ts` tem os metadados `label` e `subtitle` preenchidos.

### 3. Regras de Negócio
- [ ] A rota está sob o layout do contexto correto e protegida pelas guardas de papel/escopo?
- [ ] A tela respeita a visibilidade do papel (ex: Executor não vê HRN; arquivos `CONSULTANCY_ONLY` não chegam ao cliente)?
- [ ] Nenhuma permissão é aplicada apenas no front — o servidor valida a mesma regra?

### 4. Escolha de Ícones
- [ ] Se o ícone está na **Sidebar (menu lateral principal)**, utilizou **PrimeIcons** (ex: `'pi pi-file'`)?
- [ ] Se o ícone está **dentro da página** (botões, cards, modais), utilizou os ícones **Lucide** (ex: `<ng-icon name="lucideFileText"></ng-icon>`)?
- [ ] Os ícones Lucide utilizados foram importados e declarados no array de provedores de ícones no arquivo de configuração correspondente?
