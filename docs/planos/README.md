# Planos de Implementação

Arquivos de trabalho **efêmeros**, um por feature em desenvolvimento. Cada arquivo descreve o objetivo da feature, as decisões tomadas e o passo a passo, com caixas de seleção marcadas conforme o trabalho avança.

## Regras da pasta

1. **Um arquivo por feature**, nomeado pela feature (`autenticacao.md`, `plano-de-acao.md`).
2. **O arquivo é apagado quando a feature termina.** O histórico fica no git; não se mantém plano concluído aqui.
3. **Plano não é fonte da verdade.** Nenhuma regra de negócio nasce neste diretório — ela vive em [`docs/produto`](../produto/). O plano **referencia** o documento de produto correspondente. Se durante a implementação uma regra mudar ou for decidida, a alteração vai para `docs/produto` e o plano apenas aponta para lá.
4. **Decisão pendente não vira escolha implícita.** Se um passo depende de algo em aberto, ele fica bloqueado até a pendência ser resolvida em [`docs/produto/06_pendencias.md`](../produto/06_pendencias.md).

## Planos ativos

- [Gestão de Equipe](./gestao-de-equipe.md)
