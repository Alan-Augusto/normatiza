# Documentação Central - Sistema Normatiza

Bem-vindo à documentação técnica do sistema **Normatiza**. Este conjunto de documentos foi elaborado para servir como especificação detalhada de regras de negócio, arquitetura de software, banco de dados, fluxos de interface e integrações do sistema existente, com o objetivo claro de viabilizar uma **reescrita completa (rewrite)** do sistema em uma nova tecnologia.

---

## 1. Parecer Geral da Aplicação

O **Normatiza** é uma plataforma SaaS (Software as a Service) voltada para Engenharia de Segurança do Trabalho, especializada na conformidade técnica com a norma regulamentadora brasileira **NR-12 (Segurança no Trabalho em Máquinas e Equipamentos)** e normas correlatas (ABNT, ISO, etc.).

O sistema permite que engenheiros de segurança realizem o inventário de máquinas e equipamentos de seus clientes, analisem perigos e riscos qualitativa e quantitativamente (utilizando metodologias consagradas como o **HRN - Hazard Rating Number**), definam medidas de mitigação, façam o upload de documentações auxiliares e gerem **Laudos Técnicos de Conformidade (NR-12)** automatizados em formatos de documento (PDF e DOCX).

### Arquitetura Macro Atual
*   **Backend (API):** Desenvolvido em **.NET Core (C#)** com acesso a banco de dados relacional via **Entity Framework Core**.
*   **Frontend:** Aplicativo web Single Page Application (SPA) em **React (v17)** com estilos baseados em **Bootstrap 5 / React-Bootstrap**, integrando bibliotecas de controle de estado e cache local off-line (`localforage`).
*   **Armazenamento de Mídias:** Integração direta com o **Firebase Storage** para armazenamento de fotos tiradas durante as vistorias de campo.
*   **Integrações:** ViaCEP (autocompletar endereços), SMTP de envio de e-mails para validação de contas e recuperação de senhas.

---

## 2. Sumário da Documentação (Índice de Arquivos)

A documentação está dividida em módulos sequenciais, organizados para facilitar a análise independente de cada componente do sistema durante o desenvolvimento da nova versão:

*   [00_doc.md](file:///Users/alan-augusto/DEV/BRWORKS/normatiza/docs/00_doc.md) (Este arquivo)
    *   *Parecer geral da aplicação, arquitetura macro e índice analítico.*
*   [01_users_and_permissions.md](file:///Users/alan-augusto/DEV/BRWORKS/normatiza/docs/01_users_and_permissions.md)
    *   *Especificação detalhada dos perfis de usuário, hierarquia de acesso (multi-tenant implícito), fluxo de login, confirmação de conta, limites de licença Trial e regras de expiração.*
*   [02_database.md](file:///Users/alan-augusto/DEV/BRWORKS/normatiza/docs/02_database.md)
    *   *Mapeamento completo do banco de dados relacional, tabelas, colunas, chaves estrangeiras, relacionamentos N:N, índices e tipos de dados extraídos do Entity Framework Core.*
*   [03_business_rules_and_core_concepts.md](file:///Users/alan-augusto/DEV/BRWORKS/normatiza/docs/03_business_rules_and_core_concepts.md)
    *   *Detalhamento das regras de segurança de máquinas, cálculo do HRN (fórmula matemática de risco), conceitos de PAP (Ponto de Análise de Perigo), PE (Ponto de Entropia), gerenciamento de Normas Técnicas e Estudos de Segurança.*
*   [04_frontend_architecture_and_screens.md](file:///Users/alan-augusto/DEV/BRWORKS/normatiza/docs/04_frontend_architecture_and_screens.md)
    *   *Análise do frontend em React, rotas declaradas, layout do painel administrativo, telas de inventário e vistoria, formulários dinâmicos de riscos e armazenamento em cache local.*
*   [05_file_processing_and_generation.md](file:///Users/alan-augusto/DEV/BRWORKS/normatiza/docs/05_file_processing_and_generation.md)
    *   *Detalhamento do processamento e geração de Laudos Técnicos, preenchimento de templates em formato Word (DOCX) e PDF, tratamento de imagens e gerenciamento de arquivos enviados por clientes.*
*   [06_api_endpoints_and_integrations.md](file:///Users/alan-augusto/DEV/BRWORKS/normatiza/docs/06_api_endpoints_and_integrations.md)
    *   *Dicionário de rotas da API, métodos HTTP, payloads de requisição/resposta, validações e tratamento de erros no backend.*

---

## 3. Diretrizes para a Reescrita

1.  **Preservação das Fórmulas de Risco:** O cálculo do HRN deve ser idêntico ao implementado atualmente, assegurando consistência histórica para os laudos gerados anteriormente.
2.  **Separação Multitenancy:** O modelo de locação atual vincula clientes e analistas ao engenheiro principal. A reescrita deve isolar os escopos de dados de maneira rigorosa para impedir vazamentos de informações industriais confidenciais.
3.  **Processamento de Mídia Resiliente:** As fotos de vistoria industrial costumam ser grandes. Mecanismos de compressão no frontend antes do envio à nuvem devem ser mantidos e aperfeiçoados.
4.  **Acessibilidade Offline:** Inspetores em campo frequentemente não possuem acesso à internet. O suporte de cache offline local no dispositivo para preenchimento de checklists deve ser mapeado e reproduzido na nova pilha tecnológica.
