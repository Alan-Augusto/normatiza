import { memberOrigin } from '@normatiza/shared';

/**
 * A coluna "Origem" da Equipe da Empresa ([03 §4.5](../../../../../docs/produto/03_navegacao_e_telas.md)).
 *
 * O que se verifica aqui é uma pergunta de negócio — "de onde essa pessoa vem?"
 * —, não uma tabela de conversão. Quem responde é o servidor: a tela recebe o
 * valor pronto, para que web e app de campo não cheguem a respostas diferentes.
 */
describe('origem do membro', () => {
  it('deve reconhecer a consultoria que atende a empresa', () => {
    expect(memberOrigin(['CONSULTANT_ENGINEER'])).toBe('CONSULTANCY');
    expect(memberOrigin(['LEAD_ENGINEER'])).toBe('CONSULTANCY');
    expect(memberOrigin(['TECHNICIAN'])).toBe('CONSULTANCY');
  });

  it('deve reconhecer quem é do próprio cliente', () => {
    expect(memberOrigin(['MANAGER'])).toBe('CLIENT');
    expect(memberOrigin(['CLIENT_ENGINEER'])).toBe('CLIENT');
    expect(memberOrigin(['DIRECTOR'])).toBe('CLIENT');
  });

  it('deve separar o executor interno do terceiro contratado', () => {
    // O papel é o mesmo nos dois: o que muda é a relação contratual, e é ela
    // que o Marcos precisa enxergar para saber quem ele manda embora.
    expect(memberOrigin(['EXECUTOR'], 'INTERNAL')).toBe('CLIENT');
    expect(memberOrigin(['EXECUTOR'], 'THIRD_PARTY')).toBe('EXTERNAL');
  });

  it('deve tratar executor sem tipo declarado como do cliente', () => {
    // `executorType` é opcional no schema. Na dúvida, a resposta conservadora é
    // "é de casa" — chamar alguém de terceiro sem base é afirmar um contrato
    // que talvez não exista.
    expect(memberOrigin(['EXECUTOR'])).toBe('CLIENT');
  });

  it('deve considerar da consultoria quem carrega papel de consultoria', () => {
    // Caso raro, mas o vínculo guarda um array: vir da consultoria é o fato
    // mais forte, porque é ele que explica por que a pessoa tem acesso.
    expect(memberOrigin(['TECHNICIAN', 'DIRECTOR'])).toBe('CONSULTANCY');
  });
});
