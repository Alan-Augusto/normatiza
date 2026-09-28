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

### Onde os arquivos moram

Todo arquivo — foto, logo, documento — vive no **Firebase Storage**, o mesmo do acervo legado, e é registrado como `FileAsset` ([04 §8](./04_modelo_de_dados.md)).

- **O envio passa pela API, nunca direto do navegador ou do app para o storage.** As regras de segurança do storage não conhecem nossas sessões nem o `accountId`; o isolamento por conta só se sustenta se quem grava for o servidor.
- **A leitura é por URL assinada, com validade curta.** Nenhum arquivo tem endereço público permanente: um link vazado deixa de funcionar sozinho, e a regra de `visibility` continua valendo depois do primeiro acesso.
- **O tipo do arquivo é conferido pelo conteúdo, não pela extensão.** Um `.png` que é HTML por dentro é recusado.

---

## 5. Isolamento de dados

Duas fronteiras, ambas validadas **no servidor**, nunca apenas na interface:

1. **Conta.** Nada atravessa contas. `accountId` participa de toda consulta de entidade de negócio.
2. **Empresa, do lado cliente.** Papéis com `RoleSide: 'CLIENT'` têm exatamente um vínculo de empresa. A BRF nunca enxerga a Seara, nem por grupo empresarial, nem por busca global, nem por relatório consolidado.

A busca global respeita o escopo: **ninguém encontra na busca o que não poderia abrir navegando.**

---

## 6. Preparação para migração

A estrutura nova precisa comportar a migração de toda a base do sistema legado. As regras de produto que a migração obedece:

- **HRN reproduzível.** A versão inicial de `HrnTableVersion` replica exatamente os pesos e faixas do legado ([04 §7](./04_modelo_de_dados.md)); laudos históricos continuam recalculáveis.
- **Todo registro migrado guarda o identificador de origem**, para rastrear a correspondência com o sistema antigo.
- **Análises históricas entram concluídas e congeladas**, sem plano de ação retroativo.
- **Ninguém redefine senha por causa da migração.** O hash legado é aceito uma única vez, no primeiro login, e reescrito em Argon2id no mesmo ato ([autenticação §2](../backend/autenticacao.md)).
- **Segredos externos saem do código.** O token de conversão de documentos estava no fonte legado; toda credencial vive em variável de ambiente ou gerenciador de segredos.

O mapeamento de cada tabela e coluna do legado para o modelo novo — papéis, empresas, equipamentos, fotos — está em [Migração de Dados](../migracao/README.md), que cresce junto com cada entidade implementada.
