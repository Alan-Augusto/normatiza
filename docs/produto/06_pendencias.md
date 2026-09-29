# 06 — Pendências

Decisões ainda em aberto. Cada uma traz o que está indefinido, por que importa e o que muda dependendo da resposta.

Este documento existe para que nenhuma decisão pendente vire uma escolha implícita feita durante a implementação. **Nada aqui deve ser resolvido no código sem antes ser resolvido aqui.**

---

## 1. Origem das tarefas — PAP e PE geram plano de ação?

**Situação.** A regra escrita hoje é: um `RiskPoint` com HRN acima do limite aceitável gera um `ActionItem` ao concluir a análise. Mas a análise produz **três** tipos de apontamento — pontos de risco (HRN), não conformidades de **PAP** e não conformidades de **PE** — e apenas o primeiro está definido como gerador de tarefa.

**Por que importa.** As não conformidades de PAP e PE são exatamente o tipo de coisa que precisa virar obra: botão de emergência ausente, sinalização em português faltando, dispositivo de controle burlado, proteção sem intertravamento. O próprio exemplo usado para ilustrar o ciclo — *"uma máquina cujo único problema é um botão de emergência faltando"* — é um item de PAP, não um ponto de HRN. Do jeito que a regra está escrita, esse caso não geraria tarefa nenhuma.

**O que muda conforme a resposta:**

| Se… | Impacto |
| :--- | :--- |
| **Só HRN gera tarefa** | Modelo atual serve. Mas não conformidades de PAP/PE ficam apenas no Laudo de Apreciação, sem acompanhamento de correção — e como o portão do laudo conta apenas itens do plano de ação, o Laudo de Adequação pode ser emitido com um botão de emergência ainda faltando |
| **PAP e PE também geram** | `ActionItem.riskPointId` precisa virar uma origem polimórfica (`sourceType` + `sourceId`). O cartão do ponto muda: itens de PAP/PE não têm HRN, logo não têm HRN residual — a etapa 7 precisa de um critério de conformação alternativo |
| **Geram, mas em fluxo separado** | Duas listas de trabalho no plano de ação, com regras distintas de portão de laudo |

**Recomendação para discussão:** a segunda opção parece a mais fiel ao que o sistema promete, mas exige decidir o que substitui o HRN residual como prova de conformação para itens de checklist.

---

## 2. Reanálise periódica

**Situação.** A NR-12 pressupõe revisão periódica. O sistema deve programar reanálises — anual, por exemplo — e alertar quando vencerem?

**Por que importa.** Não muda a estrutura, mas **muda o produto**: transforma o sistema de "projeto com fim" em "assinatura contínua". É a diferença entre vender um serviço e vender uma mensalidade.

**Impacto se sim:** o campo `Equipment.nextReviewAt` já está previsto no modelo; seria preciso adicionar um bloco de vencimentos ao Dashboard Geral, um evento ao modelo de notificação e uma política de periodicidade configurável por conta ou por equipamento.

---

## 3. Diretor e visibilidade de custo

**Situação.** O Diretor vê os valores dos planos de ação?

**Argumento a favor.** É justamente ele quem se importa com investimento — o dashboard executivo mostra "investimento aprovado no período", e omitir valores esvazia o papel.

**Argumento contra.** É o único papel de leitura pura e enxerga a empresa inteira, incluindo orçamentos que talvez não devessem circular.

A matriz de permissões hoje marca `○` (leitura) para o Diretor na tabela de preços e nos relatórios gerenciais, o que implica que sim. Vale confirmar explicitamente.

---

## 4. Acervo de fotos na migração

**Situação.** As fotos do sistema legado estão no Firebase Storage, organizadas por pasta de cliente. Na migração, mantém-se as referências existentes ou reprocessa-se o acervo?

**O que pesa.** Reprocessar permite padronizar compressão, gerar os thumbnails que o novo modelo exige e normalizar metadados — mas é uma operação longa sobre um volume grande, e as fotos de laudos já emitidos são prova, não podem ser degradadas.

**Encaminhamento provável.** Migrar referências sem reprocessar os originais, gerando apenas thumbnails sob demanda. Precisa ser confirmado antes de escrever o migrador.

---

## 5. Papel do lado cliente em várias empresas

**Situação.** Todo papel do lado cliente vale para **uma empresa só** ([01 §5](./01_papeis_e_permissoes.md)). A base legada contradiz isso em escala. Dos 514 Gestores (`Manager`) vinculados a empresas, **122 estão em mais de uma**: 52 em duas, e há casos de 16, 24, 33, 44 e 46 empresas. Todos ficam dentro de um mesmo engenheiro, ou seja, de uma mesma conta na v2.

**Por que acontece.** No legado, cada unidade é um `Customer` separado: a filial deixou de existir na v1.4.0. As empresas desses Gestores são quase todas pessoas jurídicas (665 com CNPJ, 3 com CPF). O Gestor de muitas empresas é, com toda probabilidade, o gestor de segurança de um grupo que supervisiona várias unidades. A raiz do CNPJ (os 8 primeiros dígitos, que identificam matriz e filiais) confirma isso em parte. Dos 121 Gestores com várias empresas de CNPJ:
- **82 têm todas as empresas com a mesma raiz**: são matriz e filiais de uma mesma pessoa jurídica;
- 20 têm raízes em parte repetidas;
- 19 têm raízes todas diferentes: grupos de pessoas jurídicas distintas, ou um gestor terceirizado que atende várias.

**Por que importa.** Não há como migrar essas pessoas sem quebrar a regra:
- Um login por pessoa e e-mail único na conta impedem criar um usuário para cada empresa.
- Mapeá-las para um papel da consultoria as poria do lado errado: veriam a carteira e poderiam fazer análise.

É uma decisão de modelagem: mexe no escopo, no convite e na invariante do banco.

**Caminhos:**
- **Papel do cliente pelo grupo empresarial.** Um Gestor (ou Diretor) do grupo enxerga todas as empresas do `CompanyGroup`. Hoje o grupo não concede acesso ([04 §2](./04_modelo_de_dados.md)); passaria a conceder, só para papéis do lado cliente vinculados ao grupo. Na migração, a raiz do CNPJ monta o grupo sozinha para os 82 casos de matriz e filiais. Os outros 39 exigem montar o grupo à mão, e como uma empresa pertence a um grupo só, dois Gestores com conjuntos que se cruzam sem coincidir não cabem nesse modelo.
- **Vários vínculos de cliente, desde que na mesma conta.** A regra passa de "uma empresa" para "as empresas que o convidante lhe der". É mais simples, mas enfraquece a garantia de que a BRF nunca enxerga a Seara, que hoje é estrutural.
- **Manter a regra**, e migrar essas pessoas com vínculo só na empresa principal, com as demais listadas no relatório para convite manual. Perde acesso que o cliente tem hoje.

---

## 6. Empresa com CPF

**Situação.** `Company.document` só aceita CNPJ válido. Na base legada:
- 275 empresas têm CNPJ;
- **22 têm CPF**;
- 8 têm um valor com outro tamanho;
- 18 têm o documento vazio.

Numa base agroindustrial (aviário, incubatório), CPF pode ser produtor rural: um cliente legítimo, não erro de cadastro. Isso não está confirmado.

**Impacto se aceitar CPF:** o documento vira "CPF ou CNPJ", com o preenchimento automático pela Receita só para CNPJ, e o laudo imprime o rótulo certo. Os 26 casos restantes (outro tamanho ou vazio) migram sinalizados para correção, qualquer que seja a decisão.

---

## 7. O que é uma empresa: o CNPJ ou a unidade atendida?

**Situação.** O CNPJ é único na conta ([03 §3.2](./03_navegacao_e_telas.md)), o que faz da `Company` uma pessoa jurídica. A base legada trata o cliente como **unidade operacional**. Na maior conta há 20 CNPJs repetidos, somando 61 clientes. São unidades ativas, com análise em períodos que se sobrepõem, e não cadastros duplicados:

- **Áreas de uma mesma planta.** Frigorífico, incubatório, recria e armazéns sob um CNPJ, com 818, 171, 915 e 62 análises. Utilidades, empanados, salsicharia e abate sob outro. Planta, fábrica de ração, incubatório e cereais sob um terceiro.
- **Unidades produtivas numeradas.** UP01 a UP11, CD01 e ferramentaria sob um CNPJ só: 12 clientes, 3.599 análises.
- **Blocos de uma planta.** Bloco A e Bloco B, com cerca de 450 análises cada.
- **Fabricante de máquinas como cliente**, com uma "unidade" para cada planta de terceiros onde as máquinas dele estão instaladas. Aqui o endereço onde a máquina está não é o endereço do CNPJ.

**História que pesa.** O legado já teve o nível de filial entre cliente e setor (`customer_branch`) e o **removeu na v1.4.0**: voltou a um cliente por unidade. Os usuários preferiram a unidade como o objeto de primeiro nível.

**Por que importa.** Cada unidade tem o seu inventário, os seus laudos e, muitas vezes, o seu Gestor. Juntá-las numa empresa só:
- faz o Gestor de uma área enxergar as outras;
- mistura os indicadores;
- rebaixa as antigas unidades a setores, perdendo o nível de setor que elas já têm dentro de si.

**Caminhos:**
- **A empresa é a unidade atendida.** O CNPJ deixa de ser único na conta. Um CNPJ repetido gera aviso, e não recusa ("Já existe *BRF Toledo* com este CNPJ. É outra unidade?"). O nome distingue as unidades. O grupo empresarial, que pode ser montado pela raiz do CNPJ, consolida os relatórios.
  - É o que a base já é, e a migração fica direta.
  - Combina com o caminho do "Gestor do grupo" da §5.
- **A empresa é o CNPJ, e as unidades ficam dentro dela** como um nível novo entre empresa e setor. É o caminho que o legado tentou e abandonou.
- **A empresa é o CNPJ, e as unidades viram setores.** É o mais barato, mas perde o nível de setor e mistura Gestores de áreas diferentes.

---

## Como usar este documento

Ao resolver uma pendência:
1. Escreva a decisão no documento de produto correspondente (`00` a `05`).
2. **Remova a entrada daqui** — não deixe registro de decisão tomada em documento de pendências.
3. Se a decisão invalidar algo já escrito em outro documento, corrija lá também. A documentação não convive com duas verdades.
