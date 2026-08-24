# 🗄️ Sistema Legado (v0) — Especificação de Referência

Este acervo descreve o **Normatiza atual, em produção** — a versão .NET + React que será substituída. Ele foi levantado por engenharia reversa do código existente e é a fonte de referência para a **migração de dados** e para a preservação de regras de cálculo.

> **Como usar:** consulte esta pasta apenas para migração, para conferir uma regra histórica de cálculo, ou para entender por que uma decisão foi tomada. **A especificação do sistema novo está em [`docs/produto/`](../produto/README.md)** — é lá que vive o que vai ser construído.
>
> **Este acervo é congelado.** Não é atualizado, não é corrigido e não descreve intenção futura. Descreve o que existe hoje em produção.

---

## O que é o sistema atual

Plataforma SaaS para Engenharia de Segurança do Trabalho, especializada em conformidade com a **NR-12** e normas correlatas (ABNT, ISO).

Engenheiros de segurança inventariam máquinas de seus clientes, analisam perigos e riscos pelo método **HRN (Hazard Rating Number)**, definem medidas de mitigação, anexam documentação e geram **Laudos Técnicos de Conformidade NR-12** em PDF e DOCX.

### Arquitetura

*   **Backend:** .NET Core (C#) com Entity Framework Core sobre banco relacional
*   **Frontend:** SPA em React v17 com Bootstrap 5 / React-Bootstrap, cache offline via `localforage`
*   **Mídias:** Firebase Storage, para as fotos de vistoria de campo
*   **Integrações:** ConvertAPI (DOCX→PDF), PdfSharp (bloqueio do PDF), ViaCEP, SMTP/SendGrid

---

## Índice

| Documento | Conteúdo |
| :--- | :--- |
| [01 — Usuários e Permissões](./01_users_and_permissions.md) | Os sete perfis, hierarquia de acesso, multitenancy por filtro, fluxo de login, contas Trial e criptografia de senha |
| [02 — Banco de Dados](./02_database.md) | Mapeamento completo das tabelas, colunas, chaves estrangeiras, relacionamentos N:N e índices extraídos do EF Core |
| [03 — Regras de Negócio e Conceitos Core](./03_business_rules_and_core_concepts.md) | Cálculo do HRN, pesos de FE/PE/MPL/NP, faixas de risco, conceitos de PAP e PE, gestão de normas técnicas |
| [04 — Arquitetura Frontend e Telas](./04_frontend_architecture_and_screens.md) | Estrutura React, rotas declaradas, wizard de vistoria, formulários de risco e cache offline |
| [05 — Geração e Processamento de Arquivos](./05_file_processing_and_generation.md) | Pipeline de laudos: templates DOCX via OpenXML, conversão para PDF e bloqueio de segurança |
| [06 — Endpoints e Integrações](./06_api_endpoints_and_integrations.md) | Catálogo de rotas, roteamento customizado, payloads e serviços externos |

---

## O que precisa sobreviver à migração

Estes são os pontos deste acervo que têm efeito direto sobre o sistema novo:

1. **As fórmulas e tabelas de HRN** (documento 03) precisam ser reproduzidas **identicamente**, para que laudos históricos permaneçam válidos e recalculáveis.
2. **A estrutura de PAP e PE** (documento 03) é reaproveitada integralmente na nova análise.
3. **O mapa de perfis** (documento 01) alimenta a tradução de papéis descrita em [05 — Regras Transversais](../produto/05_regras_transversais.md).
4. **O modelo de dados** (documento 02) é a origem dos registros a migrar, incluindo a separação do `Customer` — que hoje acumula login de leitura e cadastro da empresa — em duas entidades distintas.

## Problemas conhecidos, corrigidos na nova versão

*   **Multitenancy frágil** — isolamento por filtro inline no Entity Framework, sem barreira estrutural
*   **Hash de senha dependente do sistema operacional** — SHA-256 com `Encoding.Default`; senhas não migram
*   **Credencial de terceiro hardcoded no código-fonte** — o token do ConvertAPI está embutido no fonte
*   **Informação sem vida útil** — gerado o PDF, o dado deixa de ser gerido; não há rastreamento de adequação ou evolução do ativo
