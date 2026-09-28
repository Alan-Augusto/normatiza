# Plano — Cadastro de Equipamentos

> **Status:** implementado (API e painel), falta o fechamento: deploy e aceite no homelab · **Criado em:** 2026-09-28
> **Regras de negócio:** [03 — Navegação §4.2, §4.3 e §5.1](../produto/03_navegacao_e_telas.md) · [04 — Modelo de Dados §2, §3, §7 e §8](../produto/04_modelo_de_dados.md) · [01 — Permissões §7](../produto/01_papeis_e_permissoes.md) · [05 — Regras Transversais §4](../produto/05_regras_transversais.md) (fotos)
> **Padrões herdados:** [Cadastro de Empresas](./cadastro-de-empresas.md): `actions` por linha, `app-data-table`, reactive forms tipado, "—" em vez de zero inventado, estado da lista na URL, formulário em página própria
> **Migração:** [docs/migracao §4 e §5](../migracao/README.md)

---

## 1. Objetivo

Trocar as três máquinas inventadas (`maquinas-provisorias.ts`) pelo inventário de verdade. O escopo é **cadastrar, listar, buscar, editar, desativar, reativar e excluir** equipamentos, **com os setores e o catálogo de tipos de máquina** de que o formulário precisa. O Contexto 3 passa a abrir a máquina real.

**Fora do escopo:**
- a análise e a ficha técnica densa;
- tudo que depende de análise: pior HRN, conformidade, pontos, última análise e os filtros por risco. As colunas nascem aqui com "—", como na lista de empresas;
- importação por planilha, QR code, exportação e "cadastrar outro igual";
- as 4 vistas da máquina, que são fotos da análise.

## 2. Estado atual

| Item | Situação |
| :--- | :--- |
| `Equipment`, `Sector`, `MachineType` | Não existem no Prisma |
| `FileAsset` | Tem `companyId` e `thumbnailKey` (nunca preenchido). Não tem `equipmentId` |
| Imagem no servidor | Só lê o tipo pelos bytes (`image-type.ts`). Não há biblioteca para redimensionar |
| Tela de equipamentos | Provisória, com as máquinas inventadas e aviso na tela |
| Contexto 3 | Alcançável, com o nome vindo de `maquinas-provisorias.ts` |
| `métricasDaEmpresa()` | `equipmentsCount: 0` fixo (`companies.service.ts`) |
| Empresa inativa | `CompanyWriteGuard` já existe e é reaproveitado |

## 3. Decisões travadas

| # | Decisão | Definição |
| :-- | :--- | :--- |
| D1 | **Quem edita** | `EQUIPMENT_EDITOR_ROLES` = Eng. Responsável, Eng. da Consultoria, Técnico, Gestor e Eng. do Cliente, na empresa do vínculo. O Diretor lê. O Executor não vê o inventário. A mesma alçada vale para os setores. Regra em 03 §4.2. |
| D2 | **O código é a chave da URL e da API** | `EQ-0001`, sequencial por empresa, com um contador em `Company.equipmentSequence` incrementado na mesma transação da criação. É imutável e não é reaproveitado, então serve de identificador em `/companies/:companyId/equipments/:code`. Na URL do painel vai em minúsculas (`eq-0042`), e a API aceita qualquer caixa. |
| D3 | **TAG única por empresa quando preenchida** | `@@unique([companyId, tag])`, com nulos livres. A recusa é 409 com `field: 'tag'`, nomeando o equipamento que já usa a TAG. |
| D4 | **Série e patrimônio repetidos: aviso, não recusa** | `GET /companies/:companyId/equipments/duplicates?serialNumber=&patrimonyCode=&except=` devolve quem já usa o valor. O formulário consulta ao sair do campo e avisa. |
| D5 | **Setor por nome normalizado** | `Sector.normalizedName` único na empresa. Criar um nome que já existe **devolve o existente**, sem erro: é o que torna a criação dentro do formulário segura. Mesclar move os equipamentos e apaga o setor de origem. Excluir só setor vazio. |
| D6 | **Tipo de máquina é catálogo** | `MachineType` com `accountId` opcional: nulo = global (semeado), preenchido = da consultoria. Criar um nome existente, global ou da conta, devolve o existente. **Só a consultoria cria**; o lado cliente escolhe ou deixa vazio. Regra em 03 §4.2. |
| D7 | **Desativar e excluir** | `deactivatedAt` / `deactivatedByUserId`, como a empresa. A lista padrão traz só os ativos; `?status=ALL` traz todos. Desativado é modo leitura. Excluir só sem análise: enquanto não houver análise no sistema, todo equipamento é excluível, e a checagem nasce com a análise. |
| D8 | **Foto principal com miniatura no servidor; a antiga se preserva** | `sharp` na API. No envio: tipo lido dos bytes (PNG/JPG/WebP), original preservado, miniatura WebP de 480 px no maior lado em `thumbnailKey`. A lista devolve a URL da miniatura, e o detalhe devolve as duas. Limite de 10 MB. Compressão no celular antes do envio fica para o app de campo. |
| D9 | **Rotas do painel** | `empresas/:companySlug/equipamentos` (lista), `…/equipamentos/novo`, `…/equipamentos/:equipmentCode/editar` (Contexto 2, declaradas antes do Contexto 3) e `…/equipamentos/:equipmentCode` (Contexto 3). `…/setores` entra no menu do Contexto 2. |
| D10 | **API sob `/companies/:companyId/…`** | `equipments` e `sectors` moram sob a empresa. Não precisam de prefixo novo no nginx, e o escopo é o da empresa. Só o catálogo é raiz, `/machine-types`, e ganha prefixo no `nginx.conf`. |
| D11 | **A lista reusa o padrão das empresas** | Busca e filtro no servidor (`q`, `sectorId`, `status`), estado na URL, `app-data-table`, `actions` por linha, "—" nas colunas de análise. Alternar entre tabela e cartões fica na URL (`?vista=cartoes`). |
| D12 | **Uma resposta de erro por campo** | TAG repetida e nome vazio voltam com `field`, como o CNPJ da empresa. |

## 4. Passos

### Fase 0 — Arquivos
- [x] `sharp` na API (binário pré-compilado; a imagem é Debian slim). Carregado por `storage/sharp.ts`, porque a API compila sem `esModuleInterop`.
- [x] `FilesService.uploadEquipmentPhoto`: tipo pelos bytes, decodificação como prova, original intacto, miniatura WebP de 480 px, `FileAsset.equipmentId`, `category: 'EQUIPMENT_MAIN_PHOTO'`. Os drivers ganham `delete`.
- [x] Trocar a foto **preserva** a anterior, como o logo: o laudo emitido aponta para o arquivo da época. Os bytes e o registro só saem com a exclusão de um equipamento que nunca teve análise (`FilesService.remove`).

### Fase 1 — Catálogo de tipos de máquina
- [x] Prisma `MachineType` + 45 tipos globais semeados **na migração** (existem em todo ambiente), com índice parcial que impede global repetido.
- [x] `GET /machine-types?q=` (global ∪ conta, sem acento nem caixa) e `POST /machine-types` (só consultoria, devolve o existente).
- [x] Prefixo `machine-types` no `nginx.conf` e conferência contra as rotas do Angular.

### Fase 2 — Setores
- [x] Prisma `Sector` (`normalizedName` único na empresa).
- [x] `GET/POST /companies/:companyId/sectors`, `PATCH …/:sectorId`, `POST …/:sectorId/merge`, `DELETE …/:sectorId`, com a alçada de D1 e a empresa inativa em modo leitura.

### Fase 3 — Equipamentos na API
- [x] Prisma `Equipment`, `Company.equipmentSequence`, `FileAsset.equipmentId`.
- [x] Lista com filtros e `actions` por linha, detalhe, criar, editar, desativar, reativar, excluir, foto, e a consulta de duplicados (D4).
- [x] `métricasDaEmpresa()` conta os equipamentos ativos de verdade.
- [x] Contratos em `@normatiza/shared`.

### Fase 4 — Painel
- [x] Setores: tela do Contexto 2 e item no menu.
- [x] Inventário: tabela e cartões, busca, filtro de setor e de ativos, estado na URL.
- [x] Formulário `novo`/`editar`: setor e tipo com criação na hora, foto, aviso de série e patrimônio repetidos, TAG recusada no campo.
- [x] Contexto 3 com a máquina real: o layout resolve o código, e o painel mostra a identificação.
- [x] Apagar `maquinas-provisorias.ts`.

### Fase 5 — Fechamento
- [ ] Atualizar [`docs/migracao`](../migracao/README.md) com o que a implementação decidiu.
- [ ] Deploy e aceite no homelab: cadastrar como Josué, como Marcos e como Fernando; ver como Débora; empresa inativa em leitura.
- [ ] Apagar este plano.
