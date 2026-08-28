import { HttpErrorResponse } from '@angular/common/http';

import { mensagemDoServidor } from './mensagem-de-erro';

/**
 * O que a pessoa lê quando algo é recusado.
 *
 * Este arquivo existe por causa de um defeito real: a tela de aceitar convite
 * chamava **qualquer** recusa de "convite expirado". O servidor dizia que a
 * senha era curta demais, e quem lia era mandado pedir um convite novo para
 * resolver um problema que não existia.
 */
describe('mensagemDoServidor', () => {
  const ALTERNATIVA = 'Não foi possível concluir agora.';

  const recusa = (status: number, corpo: unknown) =>
    new HttpErrorResponse({ status, error: corpo, statusText: 'erro' });

  it('deve repetir o que o servidor disse', () => {
    const erro = recusa(400, { message: 'A senha precisa de ao menos 10 caracteres.' });

    expect(mensagemDoServidor(erro, ALTERNATIVA)).toBe('A senha precisa de ao menos 10 caracteres.');
  });

  it('não deve trocar um motivo por outro', () => {
    // O caso que originou este arquivo: 400 por senha curta virando "convite
    // vencido" mandava a pessoa atrás de um convite novo sem necessidade.
    const erro = recusa(400, { message: 'A senha precisa de ao menos 10 caracteres.' });

    expect(mensagemDoServidor(erro, 'Este convite não vale mais.')).not.toContain('convite');
  });

  it('deve juntar a lista que a validação devolve quando mais de um campo falha', () => {
    // O `ValidationPipe` do Nest devolve array. Lendo `message` como string,
    // todas as mensagens sumiriam de uma vez, e em silêncio.
    const erro = recusa(400, { message: ['Informe um e-mail válido.', 'Informe o nome.'] });

    const texto = mensagemDoServidor(erro, ALTERNATIVA);
    expect(texto).toContain('e-mail válido');
    expect(texto).toContain('Informe o nome.');
  });

  it('deve dizer em português que houve tentativa demais', () => {
    // O limite de tentativas responde em inglês, vindo do pacote de throttling.
    const erro = recusa(429, { message: 'ThrottlerException: Too Many Requests' });

    const texto = mensagemDoServidor(erro, ALTERNATIVA);
    expect(texto).not.toContain('Throttler');
    expect(texto.toLowerCase()).toContain('tentativas');
  });

  it('deve usar a alternativa quando o defeito é do servidor', () => {
    // Um 500 não traz texto escrito para ser lido — quando traz, é rastro de
    // pilha, que não ajuda quem está do outro lado.
    expect(mensagemDoServidor(recusa(500, { message: 'Cannot read property x' }), ALTERNATIVA)).toBe(
      ALTERNATIVA,
    );
  });

  it('deve usar a alternativa quando não houve resposta nenhuma', () => {
    expect(mensagemDoServidor(recusa(0, null), ALTERNATIVA)).toBe(ALTERNATIVA);
  });

  it('deve usar a alternativa quando a recusa vem sem mensagem', () => {
    expect(mensagemDoServidor(recusa(403, {}), ALTERNATIVA)).toBe(ALTERNATIVA);
    expect(mensagemDoServidor(new Error('nem é HTTP'), ALTERNATIVA)).toBe(ALTERNATIVA);
  });
});
