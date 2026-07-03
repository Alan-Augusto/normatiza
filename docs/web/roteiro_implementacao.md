# Roteiro de Implementação de Telas e Fluxos (Frontend)

Este guia serve como um passo a passo (checklist) prático que desenvolvedores e agentes de IA devem seguir ao implementar novas telas, páginas ou fluxos completos no frontend da aplicação.

---

## 🛠️ Passo a Passo para Criar uma Nova Tela

Siga esta sequência lógica ao receber uma demanda para criar uma nova tela (exemplo: criar gerenciador de documentos em `/app/documents`):

### Passo 1: Criar a Estrutura de Pastas da Feature
Crie as pastas necessárias dentro da feature correspondente (seguindo as regras de contexto de **[docs/web/arquitetura.md](./arquitetura.md)**):
```bash
mkdir -p apps/web/src/app/features/app/documents/components
mkdir -p apps/web/src/app/features/app/documents/services
mkdir -p apps/web/src/app/features/app/documents/mocks
```

### Passo 2: Criar os Componentes com Arquivos Separados
Crie os arquivos TS, HTML e CSS obrigatórios para o componente principal. 
```bash
# Se usar Angular CLI (com schematics configurado para SCSS/CSS)
ng g c features/app/documents --skip-tests
```
> [!IMPORTANT]
> Garanta que o decorador `@Component` no arquivo `.ts` aponte para arquivos externos:
> ```typescript
> @Component({
>   selector: 'app-documents',
>   standalone: true,
>   imports: [CommonModule, RouterOutlet],
>   templateUrl: './documents.component.html',
>   styleUrl: './documents.component.css' // ou .scss se configurado
> })
> ```

### Passo 3: Registrar Rota com Lazy Loading
No arquivo [app.routes.ts](../../apps/web/src/app/app.routes.ts), adicione a nova rota dentro do escopo correto (ex: sob o layout privado `/app`):
```typescript
{
  path: 'documents',
  loadComponent: () => import('./features/app/documents/documents.component').then(m => m.DocumentsComponent)
}
```

### Passo 4: Conectar à API com Serviços Locais
Se a tela consome uma API dedicada a esta feature, crie um serviço local dentro da pasta `services/` da feature:
```bash
# Exemplo: documents.service.ts
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

### 3. Escolha de Ícones
- [ ] Se o ícone está na **Sidebar (menu lateral principal)**, utilizou **PrimeIcons** (ex: `'pi pi-file'`)?
- [ ] Se o ícone está **dentro da página** (botões, cards, modais), utilizou os ícones **Lucide** (ex: `<ng-icon name="lucideFileText"></ng-icon>`)?
- [ ] Os ícones Lucide utilizados foram importados e declarados no array de provedores de ícones no arquivo de configuração correspondente?
