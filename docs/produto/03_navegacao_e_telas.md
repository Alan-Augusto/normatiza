# 03 — Navegação e Telas

A navegação é um **funil de contexto**: o usuário sempre sabe onde está, e o menu lateral é a âncora que delimita em qual universo ele está atuando. A premissa de UX é reduzir a sobrecarga cognitiva — ninguém vê dados de uma máquina solta enquanto olha o painel da consultoria.

---

## 1. Os contextos

```
Contexto 0 — Admin do Sistema        (backoffice da plataforma)
Contexto 1 — Consultoria (Geral)     "minha operação inteira"
   └── Contexto 2 — Empresa          "esta indústria"
        └── Contexto 3 — Equipamento "esta máquina"

Transversal — Área de Execução       "minhas tarefas" (qualquer papel operacional)
```

### Ponto de entrada por papel

| Papel | Entra em |
| :--- | :--- |
| Admin do Sistema | Contexto 0 |
| Engenheiro Responsável | Contexto 1 completo |
| Engenheiro da Consultoria | Contexto 1 **reduzido à sua carteira** |
| Técnico | Contexto 1 reduzido à sua carteira, ou direto no Contexto 2 se tiver uma empresa só |
| Gestor | **Contexto 2 da sua empresa** — direto |
| Engenheiro do Cliente | **Contexto 2 da sua empresa** — direto |
| Diretor | **Contexto 2 da sua empresa** — dashboard, em modo leitura |
| Executor | Área de Execução, direto |

> **O Contexto 1 é exclusivo da consultoria.** Ele existe porque a consultoria atende várias empresas e precisa de uma camada acima delas. Papéis da consultoria que atendem uma carteira entram no Contexto 1 vendo **apenas as empresas do seu escopo**.
>
> Todo papel do lado cliente pertence a uma única empresa — não existe nada acima dela para navegar. O cliente **nasce dentro do Contexto 2 e nunca sai dele**.
>
> O Gestor **precisa** administrar equipe e tabela de preços. Por isso essas telas vivem **dentro do Contexto 2** (§4.5 e §4.6), não numa camada acima. O cliente administra a empresa dele sem nunca ver que existe uma camada de consultoria.

---

## 2. Contexto 0 — Admin do Sistema

*Acesso: Admin da plataforma. Backoffice interno, isolado da aplicação principal.*

### 2.1. Contas
Listagem de todas as contas (consultorias) da plataforma. Colunas: Nome, Dono, Empresas atendidas, Usuários, Equipamentos, Análises, Status, Criada em.
Ações: criar conta, suspender, reativar, **acessar como** (impersonação auditada).

### 2.2. Configuração da Conta
Formulário por conta: dados da consultoria e status (ativa / suspensa).

*Limites comerciais, planos e faturamento ficam para depois — a estrutura vem primeiro.*

### 2.3. Catálogos Globais
Bases compartilhadas por todas as contas, mantidas pela plataforma:
- **Normas NR-12 e correlatas** — código, título, texto do item. Alimentam a seleção de "normas descumpridas".
- **Tipos de perigo** e suas **origens** e **consequências**.
- **Tipos de proteção / dispositivos de segurança.**
- **Tabelas HRN** — os pesos de FE, PE, MPL e NP e as faixas de classificação de risco.

> ⚠️ **Os valores de HRN são regulados por norma e por consistência histórica.** Editáveis apenas aqui, **com versionamento**: um laudo emitido em 2024 precisa continuar reproduzível com a tabela vigente naquela data.

### 2.4. Auditoria da Plataforma
Log global: logins, impersonações, alterações de catálogo, exclusões.

---

## 3. Contexto 1 — Consultoria (Visão Geral)

*Acesso: exclusivo do lado consultoria — Engenheiro Responsável (completo), Engenheiro da Consultoria e Técnico (reduzidos à própria carteira de empresas).*

### 3.1. Dashboard Geral
Central de controle da operação.

**Cards de resumo:** Empresas ativas · Equipamentos cadastrados · Análises no período · Laudos emitidos · Pontos em aberto · Pontos atrasados.

**Grau de adequação global:** percentual médio de conformidade NR-12 somando todas as empresas do escopo, com evolução no tempo.

**Fila de trabalho da consultoria** — o que exige ação *minha*:
- Análises em andamento
- **Pontos aguardando validação** (etapa 6 — evidência entregue pelo cliente)
- **Equipamentos prontos para Laudo de Adequação** (todos os pontos conformados)
- Laudos pendentes de assinatura

**Painel de acompanhamento do cliente** — o que exige ação *deles*, para eu cobrar:
- Pontos parados em "Estudando adequação" há mais de X dias
- Pontos aguardando aprovação do gestor
- Pontos com prazo vencido

**Distribuição de risco:** equipamentos por faixa de HRN, do aceitável ao inaceitável.

### 3.2. Empresas
Lista das empresas atendidas. Clicar em uma **muda o contexto** para o Contexto 2.

**Tela:** busca por nome/CNPJ, filtro por status e por grau de adequação. Tabela com Nome, CNPJ, Cidade, Equipamentos, % de adequação, Pontos em aberto, Última análise.

**Formulário de Empresa:**
- *Identificação:* Razão Social, Nome Fantasia, CNPJ, Inscrição Estadual
- *Contato técnico:* Responsável, Cargo, E-mail, Telefone, Celular
- *Endereço:* CEP (busca automática), Logradouro, Número, Complemento, Bairro, Cidade, UF
- *Agrupamento:* **Grupo empresarial** (ex.: "Grupo BRF") — agrupa empresas do mesmo cliente **apenas para consolidar relatórios do lado consultoria**. Não concede acesso: pertencer ao mesmo grupo não faz a BRF enxergar a Seara
- *Metadados:* Código interno / ERP, Observações
- *Logo da empresa* — aparece nos laudos

### 3.3. Equipe
Gestão dos usuários da conta.

**Tela:** árvore ou tabela com Nome, Papel, Quem convidou, Escopo (empresas), Último acesso, Status. Filtro por papel e por empresa.

**Formulário de Convite:**
- *Dados:* Nome, E-mail, Telefone
- *Papel:* a lista oferecida depende de quem convida — o lado consultoria pode convidar qualquer papel; o Gestor só convida papéis do lado cliente
- *Tipo de executor* (quando Executor): Interno da empresa | Terceiro contratado — se terceiro, vincular à empresa prestadora
- *Perfil profissional* (quando Engenheiro/Técnico): Tipo de registro (CREA, CFT), Número do registro, Cargo
- *Escopo:* seleção das empresas — **a lista oferecida contém apenas as empresas do escopo de quem está convidando**
- *Envio:* e-mail de convite com link de definição de senha

**Ações:** reenviar convite, editar escopo, redefinir senha, **desligar usuário** (§3.4).

### 3.4. Desligamento com Sucessão

Tela dedicada, acionada ao desligar um usuário que tenha subordinados, escopo ou tarefas.

**Passo 1 — Diagnóstico.** O sistema mostra o que está sob responsabilidade do usuário:
- Usuários abaixo dele na árvore
- Empresas do seu escopo
- Tarefas em que é responsável, por status
- Análises em andamento

**Passo 2 — Sucessão.** Escolha obrigatória de um sucessor, que deve ter papel e escopo compatíveis. É possível dividir: subordinados para um, tarefas para outro.

> **Trava do último gestor:** se o usuário desligado é o único Gestor de uma empresa, o sucessor indicado precisa obrigatoriamente ser um Gestor daquela empresa. Nenhuma empresa pode ficar sem gestor, porque nenhum plano de ação pode ficar sem quem aprove.

**Passo 3 — Confirmação.** Resumo do que será transferido, confirmação explícita, registro no histórico. Só então o acesso é revogado.

> O usuário desligado **nunca é apagado** — vira inativo. O nome dele continua aparecendo no histórico ("Análise realizada por Fernando em 12/03") porque isso é registro técnico e não pode sumir.

### 3.5. Personalização de Laudos
Deixar o documento gerado com a identidade da consultoria.
- Upload de logotipo (cabeçalho e rodapé)
- Cores base do relatório
- Dados do responsável técnico: Nome, CREA/CFT, número da ART, assinatura digitalizada
- Textos padrão editáveis: introdução metodológica, descrição da metodologia HRN, termo de encerramento, ressalvas

### 3.6. Meus Cadastros (Catálogos da Consultoria)
Bases próprias da consultoria, que **estendem** os catálogos globais:
- **Origens de perigo e consequências** personalizadas
- **Textos padrão de solução** — biblioteca de soluções recorrentes que o engenheiro reaproveita ao descrever pontos de risco. Economiza muito tempo em análise
- **Modelos de análise / checklists** por tipo de máquina

> ⚠️ **Não confundir com a tabela de preços.** Preços e fornecedores **não vivem aqui** — pertencem a cada empresa cliente (§4.6).

### 3.7. Relatórios Gerenciais
Visão consolidada para apresentar ao cliente ou usar internamente:
- Evolução do grau de adequação por empresa e por período
- Custo total investido em adequações por empresa
- Tempo médio entre análise e conformidade
- Ranking de equipamentos mais críticos
- Produtividade da equipe (análises por técnico/período)
- Exportação em PDF e planilha

---

## 4. Contexto 2 — Empresa

*Acesso: todos os papéis com escopo naquela empresa — dos dois lados.*
*O cabeçalho da aplicação deve deixar permanentemente visível qual empresa está em contexto.*

### 4.1. Dashboard da Empresa
Visão executiva da situação de segurança da planta.

- **Indicadores:** Total de equipamentos · Conformes vs. Não conformes · Pontos em aberto · Pontos atrasados · Investimento aprovado no período
- **Grau de adequação da planta** com evolução no tempo
- **Distribuição por faixa de risco** — quantos equipamentos em cada nível de HRN
- **Distribuição por setor** — onde está concentrado o risco
- **Funil do plano de ação** — quantos pontos em cada uma das 7 etapas do ciclo
- **Alertas:** pontos com prazo vencido, pontos aguardando minha ação

### 4.2. Equipamentos
Inventário da planta. Clicar em um equipamento **muda o contexto** para o Contexto 3.

**Tela:** busca, filtro por setor, por status de conformidade e por faixa de risco. Visualização em tabela ou cards com foto. Colunas: Foto, Nome, TAG, Setor, Pior HRN atual, Status, Pontos em aberto, Última análise.

**Formulário de cadastro inicial** — *a ficha técnica densa é preenchida durante a análise; aqui é só criar o registro*:
- Nome do equipamento, TAG de identificação, Modelo, Fabricante
- Setor (seleção)
- Foto principal
- Número de patrimônio

### 4.3. Setores
Organização física da planta — galpões, linhas de produção, áreas.
Tabela simples. Formulário: Nome, Descrição, Responsável pelo setor.

### 4.4. Plano de Ação Consolidado
Visão de **todos os pontos de todos os equipamentos** da empresa em um só lugar. É a tela de trabalho principal do Engenheiro do Cliente e do Gestor.

**Visualizações:**
- **Quadro por etapa** — colunas correspondentes às 7 etapas do ciclo. As transições obedecem à tabela de transições; não é arrastar livre
- **Tabela** — para operação em volume, com ordenação e seleção múltipla
- **Cronograma** — linha do tempo dos prazos, para enxergar sobreposição e atraso

**Cartão do ponto:** Nome do risco · Equipamento · Setor · HRN · Prazo (com destaque se vencido) · Responsável · Valor orçado · Etapa atual.

**Filtros:** equipamento, setor, responsável, etapa, faixa de risco, prazo (vencidos / vencendo em 7 dias / no prazo), tipo de execução (interno/terceiro).

**Ações em lote:** designar responsável, definir prazo, enviar para aprovação.

### 4.5. Equipe da Empresa
Quem tem acesso a esta empresa: usuários da consultoria alocados, usuários do próprio cliente e terceiros contratados. Mostra papel, escopo e origem do convite.
Permite convidar diretamente no contexto da empresa — o escopo já vem preenchido.

### 4.6. Tabela de Preços e Fornecedores

Base de custos **da empresa cliente**, usada para montar os orçamentos dos planos de ação.

**Por que aqui e não na consultoria:** quem orça a obra é o Engenheiro do Cliente, com os fornecedores e preços praticados naquela planta. A tabela de custos da consultoria não serve para orçar a obra de terceiros. Cada empresa acumula sua própria base ao longo do tempo.

**Estrutura do item:**

| Campo | Observação |
| :--- | :--- |
| **Descrição do item** | Ex.: "Botoeira de emergência tipo cogumelo com trava" |
| **Categoria** | Peça / Material / Mão de obra / Serviço / Outros |
| **Fornecedor** | Vinculado ao cadastro de fornecedores |
| **Valor unitário** | Preço praticado |
| **Unidade** | un, m, kg, h, serviço |
| **Código / SKU** | Referência do fornecedor, opcional |
| **Ativo / Inativo** | Item descontinuado sai das buscas mas permanece nos orçamentos antigos |
| **Histórico de preço** | Cada alteração de valor guarda data e quem alterou — orçamento antigo precisa continuar coerente com o que foi aprovado na época |
| **Data da última cotação** | Sinaliza item com preço defasado no momento de orçar |
| **Observação técnica** | Especificação, norma atendida, link do catálogo |

**Cadastro de Fornecedor:** Nome/Razão Social, CNPJ, Contato, Telefone, E-mail, Categoria de fornecimento, Observações.

#### Cadastro inline durante a tarefa

O ponto central desta funcionalidade: ao montar o orçamento de um ponto, o engenheiro busca o item na tabela e, **se não existir, cadastra ali mesmo sem sair do formulário** — descrição, fornecedor, valor. O item é gravado na base da empresa e fica disponível para todas as adequações seguintes.

**A tabela se constrói pelo uso**, não por um cadastro prévio que ninguém faria.

**Quem edita:** o Engenheiro do Cliente cadastra e usa durante a execução. Gestor e Engenheiro Responsável têm gestão completa da tabela de cada empresa do seu escopo — podem corrigir valores, desativar itens, reorganizar categorias.

### 4.7. Arquivos da Empresa
Repositório de documentos gerais, não vinculados a um equipamento específico: plantas baixas, PGR, PCMSO, contratos, ordens de serviço.

**Formulário:** Arquivo, Título, Descrição, Categoria, **Visibilidade** (Interno da consultoria / Visível ao cliente), Data de validade para documentos que expiram.

### 4.8. Histórico da Empresa
Linha do tempo de tudo que aconteceu nesta empresa: equipamentos cadastrados, análises, aprovações, adequações concluídas, laudos emitidos, usuários convidados.

---

## 5. Contexto 3 — Equipamento

*O equipamento é o centro. Todas as abas referem-se apenas à máquina selecionada.*

### 5.1. Dashboard do Equipamento
Radiografia da máquina.
- Foto principal e galeria das 4 vistas
- Identificação: Nome, TAG, Modelo, Fabricante, Ano, Setor, Patrimônio
- **Selo de conformidade NR-12** com cor baseada no pior HRN atual
- Indicadores: Pontos de risco mapeados · Pontos em aberto · Pontos conformados · Investimento previsto vs. realizado · Data da última análise · Próxima revisão prevista
- **Barra de progresso da adequação** — quantos pontos faltam para liberar o Laudo de Adequação. O denominador são os pontos que geraram tarefa; pontos aceitáveis ficam de fora
- Comparativo HRN original × HRN residual, quando houver

### 5.2. Análises de Risco

**Tela principal:** histórico de análises da máquina. Colunas: Nº, Data de início, Data de conclusão, Responsável técnico, Pontos identificados, Pior HRN, Status. Ações: abrir, continuar, duplicar como base para nova análise, imprimir laudo.

> **Imutabilidade:** análise concluída é **congelada**. Correção posterior gera **nova revisão versionada**, nunca edição silenciosa — o laudo comparativo depende disso para ter valor probatório.

#### Assistente de Análise — 4 Etapas

**Etapa 1 — Ficha Técnica**

- *Identidade:* Nome, Modelo, Tipo de máquina, Ano de fabricação, Número de série, TAG, Patrimônio
- *Localização:* Setor
- *Fabricante:* Nome, CNPJ, CREA, Endereço, Cidade, CEP
- *Características físicas:* Altura, Largura, Profundidade, Peso
- *Produtividade e tempos:* Capacidade produtiva, Potência, Tempo de ciclo, Tempo de acionamento, Tempo de parada de emergência
- *Operação:* Postos de comando, Total de operadores expostos, Regime de uso (turnos). Textos longos: Descrição do processo, Intervenções comuns do operador, Outras informações
- *Fontes de energia:* Elétrica · Pneumática · Hidráulica · Mecânica · Radioativa · Captação
- *Gestão de segurança:* Manual em português? · Procedimentos de trabalho formalizados? · Manutenção preventiva registrada? · Plano de manutenção previsto? · Registro disponível no ato da vistoria?
- *Reconhecimento visual:* 4 fotos obrigatórias — Frontal, Lateral Esquerda, Lateral Direita, Superior

**Etapa 2 — Pontos de Risco e HRN**

Lista dinâmica de pontos identificados. Cada ponto:

- **Local** na máquina
- **Origem do perigo** e **Consequência** (catálogos)
- **Proteções existentes** no ponto
- **Normas descumpridas** — seleção múltipla dos itens da NR-12
- **Calculadora HRN:**

  | Fator | Faixa | Significado |
  | :--- | :--- | :--- |
  | **FE** — Frequência de exposição | 0,5 a 5,0 | Anual → Constante |
  | **PE** — Probabilidade de ocorrência | 0,03 a 15,0 | Quase impossível → Certo |
  | **MPL** — Máxima perda possível | 0,1 a 15,0 | Arranhão → Fatalidade |
  | **NP** — Pessoas expostas | 1 a 12 | 1-2 pessoas → mais de 50 |

  `HRN = FE × PE × MPL × NP`

  Classificação automática: Aceitável (≤1) · Muito Baixo (1,1–5) · Baixo (5,1–10) · Significante (10,1–50) · Alto (50,1–100) · Muito Alto (100,1–500) · Extremo (500,1–1000) · Inaceitável (>1000)

  > ⚠️ **A fórmula e as tabelas de peso devem ser idênticas às atuais**, para que laudos históricos permaneçam reproduzíveis após a migração. Os valores completos estão em [04 — Modelo de Dados](./04_modelo_de_dados.md).

- **Solução sugerida** — texto do que precisa ser feito. É o que o cliente vai ler na fase de execução, então precisa ser claro e acionável
- **Foto do ponto de perigo** — a foto do "antes" do laudo comparativo
- **Categoria de uso**

**Gatilho:** ponto com HRN **acima** do limite aceitável (`> 1,0`) gera automaticamente uma tarefa no Plano de Ação ao concluir a análise. Ponto na faixa *Aceitável* fica registrado na análise e no Laudo de Apreciação, mas não gera tarefa — não há o que adequar.

**Etapa 3 — PAP (Pontos de Análise de Perigo)**

Três seções — **Acionamento**, **Rearme**, **Parada de Emergência** — cada uma com 6 quesitos, avaliados em duas dimensões: *estado físico* (existe / está assim?) e *conformidade NR-12* (atende?).

1. **Instalação** — o dispositivo existe?
2. **Prevenção de acionamento involuntário** — tem proteção contra toque acidental?
3. **Antifraude** — é difícil burlar ou travar permanentemente?
4. **Área segura** — aciona sem expor as mãos a partes móveis?
5. **Extrabaixa tensão** — opera em tensão de comando segura (máx. 24V)?
6. **Sinalização em português** — identificação clara e legível?

Cada seção: campo de solução e foto do painel/botão auditado.

**Etapa 4 — PE (Pontos de Entropia)**

Checklist de desgaste, envelhecimento e violação. Cada item avaliado em estado físico e conformidade NR-12:

- Dispositivo de partida com desgaste
- Ausência de controle em baixa tensão no circuito exposto
- Rearme por comutador fixo em vez de manual momentâneo
- Ausência ou má conservação de sinalização em português
- Dispositivos de controle burlados ou danificados
- Proteções abertas sem intertravamento ativo
- Acionamento de um motor disparando outro circuito perigoso
- Ausência de retenção elétrica de segurança em queda de energia

Campo de solução e foto do painel elétrico ou parte desgastada.

**Conclusão da análise:** revisão do resumo (pontos identificados, HRN por ponto, não conformidades PAP/PE) → confirmação → **congela a análise, gera as tarefas do plano de ação e notifica o cliente**.

### 5.3. Estudos de Segurança
Projetos técnicos das proteções propostas, anexados antes da execução.
- *Resumo:* texto explicando a lógica de intertravamento e a solução de engenharia
- *Relação de proteções:* dispositivos propostos — Nome, Característica técnica, Norma atendida, Status de instalação
- *Galeria:* upload múltiplo de croquis, desenhos, PDFs de CAD, fotos editadas
- *Vínculo:* quais pontos de risco este estudo endereça

### 5.4. Plano de Ação do Equipamento

Quadro focado apenas nesta máquina, com as 7 etapas do ciclo. Os cartões nascem automaticamente dos pontos de risco acima do limite aceitável.

#### O Cartão do Ponto — formulário completo

**Cabeçalho — somente leitura, vindo da análise:**
Nome/local do risco · Origem e consequência · Normas descumpridas · HRN e classificação · **Solução sugerida pela consultoria** · Foto do perigo · Data e responsável pela análise.

> Esta seção é **intocável pelo lado cliente**. É a apreciação de riscos da consultoria.

**Designação — preenchida pelo Engenheiro do Cliente:**
- **Tipo de execução:** Equipe interna | Terceiro contratado
- **Responsável:** um Executor, do tipo correspondente
- **Executores adicionais:** outros participantes, com a especialidade de cada um — o caso real é o engenheiro que precisa de um mecânico para a parte mecânica e um eletricista para a automação. Todos enxergam a tarefa na sua Área de Execução e podem registrar andamento
- **Data prevista de início** e **Prazo final**
- **Observações da execução**

**Orçamento — preenchido pelo Engenheiro do Cliente:**
- Itens buscados na **tabela de preços da empresa** (§4.6), com **cadastro inline** de itens novos
- Cada linha: Item · Fornecedor · Quantidade · Valor unitário · Subtotal
- **Total calculado automaticamente**
- Anexo de orçamento externo (PDF do fornecedor), opcional

**Aprovação — do Gestor:**
- Status: pendente / aprovado / reprovado
- Data, quem aprovou
- Justificativa obrigatória na reprovação

**Execução e Evidência:**
- Registro de andamento — comentários com data e autor
- **Fechamento:** exige **foto do ponto adequado** *e* **descrição do que foi feito**. Ambos obrigatórios
- Anexos complementares: nota fiscal, certificado do dispositivo, ART do instalador

**Validação da consultoria:**
- Aprovar ou **reprovar este ponto** com justificativa — volta para execução
- **HRN residual:** novo cálculo de FE, PE, MPL e NP após a adequação, preenchido apenas pela consultoria
- Comparativo automático: HRN original × residual

**Histórico do ponto:** todas as transições de etapa, com data, autor e justificativas de reprovação. **Nunca sobrescrito.**

### 5.5. Laudos Técnicos

Motor de geração de documentos (PDF e DOCX).

**Tela:** laudos emitidos anteriormente, com data, tipo, responsável técnico, versão e download.

**Tipos de laudo:**

**1. Apreciação de Riscos** — documento inicial de diagnóstico.
Baseado em uma análise concluída. Contém: ficha técnica, fotos de reconhecimento, todos os pontos de risco com HRN e fotos, tabelas PAP e PE com as não conformidades, normas descumpridas, soluções sugeridas e a metodologia HRN.

**2. Laudo de Adequação** — documento certificador final.
**Só é liberado quando todos os pontos do equipamento estiverem conformados** — isto é, todos os itens do plano de ação em estado *Ponto conformado*. Pontos em faixa aceitável não entram nessa conta, porque nunca geraram tarefa. Contém, para cada ponto: foto do perigo (antes) × foto da evidência (depois), HRN original × HRN residual, descrição da adequação executada, responsável e data. Fecha com o parecer técnico de conformidade e a ART.

**3. Relatório Gerencial** — visão consolidada por empresa ou por período, com investimento, prazos cumpridos e evolução do grau de adequação.

**Formulário de geração:** seleção da análise base, tipo de laudo, formato (PDF/DOCX), inclusão opcional de anexos, responsável técnico assinante.

> Todo laudo emitido é **versionado e imutável**. Reemissão gera nova versão, preservando a anterior.

### 5.6. Histórico do Equipamento
Linha do tempo vertical, alimentada automaticamente:

> "Equipamento cadastrado" · "Análise 01 iniciada por Fernando" · "Análise 01 concluída por Carla — 7 pontos identificados" · "Ponto 'Zona de prensagem' orçado em R$ 3.200 por Antonio" · "Orçamento aprovado por Marcos" · "Adequação finalizada por Rafael com evidência" · "Ponto reprovado por Carla: a foto não comprova a instalação da trava" · "Laudo de Adequação emitido"

### 5.7. Arquivos do Equipamento
Documentação técnica da máquina: manuais, esquemas elétricos, certificados de calibração, ARTs, notas fiscais de dispositivos de segurança.
Formulário: Arquivo, Título, Descrição, Categoria, Visibilidade, Validade.

---

## 6. Área de Execução (Minhas Tarefas)

*Acesso: todos os papéis operacionais. É a tela inicial — e única — do Executor.*

Visão transversal e pessoal: **tudo que depende de mim**, atravessando empresas e equipamentos.

**Seções:**
- **Aguardando minha ação** — o que está travado em mim
- **Em andamento** — o que estou executando
- **Atrasadas** — em destaque
- **Concluídas** — histórico

**Cartão:** Empresa · Equipamento · Local do risco · Solução sugerida · Prazo · Etapa.

**Ação principal:** abrir a tarefa, ver o que precisa ser feito, registrar andamento e **finalizar com foto + descrição**.

**Visão restrita do Executor:** enxerga apenas nome do equipamento, local do ponto, solução sugerida, prazo e o campo de evidência. Não vê HRN, não vê a análise, não vê outros pontos da máquina, não vê outras máquinas, não vê valores além dos da própria tarefa. Vale igualmente para o executor interno e para o terceiro — a diferença entre eles é contratual, não de visibilidade.

---

## 7. Ferramenta global — Busca

Campo de busca permanente no cabeçalho, com resultados categorizados: Empresas · Equipamentos · Pontos de risco · Tarefas · Laudos.

Clicar num resultado **quebra o contexto atual** e leva direto ao contexto exato onde aquele dado existe — respeitando sempre o escopo do usuário: ninguém encontra na busca o que não poderia abrir navegando.
