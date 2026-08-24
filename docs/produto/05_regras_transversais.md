# 05 — Regras Transversais

Regras que não pertencem a uma tela ou a um papel específico, mas atravessam o sistema inteiro. Valem para toda funcionalidade, presente e futura.

---

## 1. Imutabilidade e versionamento

**Análise concluída, laudo emitido e orçamento aprovado são congelados.** Alteração posterior gera **nova versão**, preservando a anterior.

O sistema produz documentos com valor técnico-legal: **reescrever o passado não é uma opção.**

| O que congela | Quando | Como se corrige |
| :--- | :--- | :--- |
| Análise (e todos os seus pontos, PAP e PE) | Ao concluir | Nova revisão, apontando para a anterior |
| Orçamento do ponto | Ao ser aprovado pelo Gestor | Reprovar e voltar à etapa 2, ou aditivo versionado |
| Laudo | Ao ser emitido | Reemissão gera nova versão; a anterior permanece baixável |
| Tabelas HRN | Sempre versionadas | Nova versão com vigência datada |

**Consequência prática:** a análise guarda qual versão das tabelas HRN usou. Sem isso, alterar um peso no catálogo global reescreveria retroativamente o risco calculado em laudos já assinados.

---

## 2. Trilha de auditoria

Toda transição de etapa, aprovação, reprovação e alteração de dado sensível registra **quem, quando, o quê e por quê**.

- **Justificativa é obrigatória em toda reprovação** — do Gestor (etapa 3 → 2) e da consultoria (etapa 6 → 4).
- **O histórico do ponto é append-only.** As reprovações se acumulam; nenhuma é sobrescrita pela seguinte.
- **Usuário desligado nunca é apagado** — vira inativo e continua nomeado no histórico. "Análise realizada por Fernando em 12/03" é registro técnico e não pode sumir.
- **Impersonação de conta pelo Admin da plataforma é sempre auditada**, com início, fim e ações praticadas.

---

## 3. Notificações

Cada handoff entre organizações é onde o processo trava na vida real. Notificação não é enfeite: é o mecanismo que mantém o ciclo andando.

Eventos que disparam notificação — in-app e e-mail:

| Evento | Destinatário |
| :--- | :--- |
| Análise concluída | Cliente |
| Orçamento enviado para aprovação | Gestor |
| Orçamento aprovado ou reprovado | Engenheiro do Cliente |
| Tarefa designada | Responsável, incluindo executor terceiro |
| Evidência entregue | Consultoria |
| Ponto reprovado | Responsável |
| **Todos os pontos conformados** | Consultoria — libera o laudo |
| Prazo vencendo em 3 dias / prazo vencido | Responsável e Gestor |

---

## 4. Fotos

As fotos são o **principal ativo de prova** do sistema e o principal peso do laudo. Tratamento obrigatório:

- **Compressão antes do envio** — inspeções são feitas em celular, e o arquivo bruto é grande demais
- **Thumbnail gerado no upload** — listagens e cartões nunca carregam o original
- **Original preservado** — é ele que entra no documento gerado
- **Metadados:** data, autor e geolocalização quando disponível
- **Funcionamento offline:** a foto tirada em campo sem conexão é enfileirada localmente e sincronizada depois, sem perda

O par foto do perigo (antes) × foto da evidência (depois) é o que dá valor ao Laudo de Adequação. As duas precisam sobreviver a qualquer reprocessamento de acervo.

---

## 5. Isolamento de dados

Duas fronteiras, ambas validadas **no servidor**, nunca apenas na interface:

1. **Conta.** Nada atravessa contas. `accountId` participa de toda consulta de entidade de negócio.
2. **Empresa, do lado cliente.** Papéis com `RoleSide: 'CLIENT'` têm exatamente um vínculo de empresa. A BRF nunca enxerga a Seara, nem por grupo empresarial, nem por busca global, nem por relatório consolidado.

A busca global respeita o escopo: **ninguém encontra na busca o que não poderia abrir navegando.**

---

## 6. Preparação para migração

Mesmo sem migrar agora, a estrutura precisa comportar a migração posterior de toda a base atual.

### Fórmula e tabelas HRN idênticas
Laudos históricos devem permanecer reproduzíveis. A versão inicial de `HrnTableVersion` replica exatamente os pesos e faixas do sistema legado.

### Mapa de papéis

| Sistema legado | Novo papel |
| :--- | :--- |
| `Admin` | Admin do Sistema |
| `Engineer` | Engenheiro Responsável (dono da conta) |
| `Analyst` | Técnico |
| `GuestEngineer` | Engenheiro da Consultoria |
| `Manager` | Gestor |
| `Customer` | **Diretor** — leitura pura, que é exatamente o que ele já era |

O `Customer` do sistema legado acumula duas coisas: era o **usuário de leitura** e também a **entidade empresa** — a tabela `user` guarda razão social, CNPJ e endereço da indústria. **Na migração isso se separa:** os dados corporativos viram o registro de `Company` e o login vira um `Membership` com papel `DIRECTOR` vinculado a ela.

Os papéis **Engenheiro do Cliente** e **Executor** não têm origem na base atual — nascem vazios e são preenchidos no onboarding de cada cliente.

### Regras da migração

- **Referência ao identificador de origem** em cada registro migrado, para rastrear a correspondência com o sistema antigo
- **Análises históricas entram como concluídas e congeladas**, sem plano de ação retroativo
- **Senhas não migram.** O esquema legado (SHA-256 com `Encoding.Default`, dependente do sistema operacional do host) é frágil. A migração exige redefinição de senha por todos os usuários, com o novo esquema usando Argon2id ou PBKDF2-SHA512
- **Segredos externos saem do código.** O token de conversão de documentos estava hardcoded no fonte legado; na nova versão toda credencial vive em variável de ambiente ou gerenciador de segredos
- **Fotos** hoje no Firebase Storage: decidir entre manter as referências ou reprocessar o acervo — ver [06 — Pendências](./06_pendencias.md)

A especificação completa do sistema legado, para consulta durante a migração, está em [`docs/legado/`](../legado/README.md).
