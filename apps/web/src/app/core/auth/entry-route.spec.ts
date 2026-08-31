import { rotaDeEntrada } from './entry-route';
import { BRF, SEARA, sessão, vínculo } from './testing/sessao';

/**
 * "Entra em" da tabela de [03 §1](../../../../../docs/produto/03_navegacao_e_telas.md).
 *
 * O que está em jogo aqui não é conveniência: o lado cliente **nasce dentro do
 * Contexto 2 e nunca sai dele**. Mandar um Gestor para o dashboard da
 * consultoria seria mostrar a ele que existe uma camada acima da empresa dele —
 * e as outras empresas atendidas junto.
 */
describe('rotaDeEntrada', () => {
  it('deve levar ao Contexto 0 o admin que só opera a plataforma', () => {
    // Sem vínculo em conta nenhuma, não há aplicação do outro lado: mandá-lo
    // para `/app/profile` seria abrir uma tela que não é o trabalho dele.
    expect(rotaDeEntrada(sessão([], true))).toBe('/admin');
  });

  it('deve levar à consultoria quem é admin da plataforma e também da própria consultoria', () => {
    // É o caso do dono do produto: Engenheiro Responsável da consultoria dele e
    // dono da plataforma, com **um** login. Ele é dono da plataforma de vez em
    // quando e dono da consultoria todo dia — o backoffice é porta ao lado, não
    // porta maior, e ele a toma pelo menu quando quiser.
    expect(rotaDeEntrada(sessão([vínculo(BRF.id, ['LEAD_ENGINEER'])], true))).toBe(
      '/app/dashboard',
    );
  });

  it('deve valer o mesmo para o admin que é do lado cliente', () => {
    // A dimensão de plataforma não muda de que lado a pessoa trabalha: ela
    // continua nascendo dentro do Contexto 2 da empresa dela.
    expect(rotaDeEntrada(sessão([vínculo(BRF.id, ['MANAGER'])], true))).toBe(
      `/app/companies/${BRF.id}/dashboard`,
    );
  });

  it('deve ir ao Contexto 0 o admin cujos vínculos foram todos desativados', () => {
    // "Tem vínculo" é vínculo **ativo**: quem foi desligado de tudo não tem
    // aplicação para onde entrar, mesmo com as linhas antigas na sessão.
    const desligadoDeTudo = [vínculo(BRF.id, ['LEAD_ENGINEER'], { isActive: false })];
    expect(rotaDeEntrada(sessão(desligadoDeTudo, true))).toBe('/admin');
  });

  it('deve levar o Engenheiro Responsável ao Contexto 1', () => {
    expect(rotaDeEntrada(sessão([vínculo(BRF.id, ['LEAD_ENGINEER'])]))).toBe('/app/dashboard');
  });

  it('deve levar a consultoria com carteira ao Contexto 1', () => {
    const carteira = [
      vínculo(BRF.id, ['CONSULTANT_ENGINEER']),
      vínculo(SEARA.id, ['CONSULTANT_ENGINEER']),
    ];
    expect(rotaDeEntrada(sessão(carteira))).toBe('/app/dashboard');
  });

  it('deve levar o Gestor direto ao Contexto 2 da empresa dele', () => {
    expect(rotaDeEntrada(sessão([vínculo(BRF.id, ['MANAGER'])]))).toBe(
      `/app/companies/${BRF.id}/dashboard`,
    );
  });

  it('deve levar o Engenheiro do Cliente direto ao Contexto 2', () => {
    expect(rotaDeEntrada(sessão([vínculo(SEARA.id, ['CLIENT_ENGINEER'])]))).toBe(
      `/app/companies/${SEARA.id}/dashboard`,
    );
  });

  it('deve levar o Diretor ao dashboard da empresa dele', () => {
    expect(rotaDeEntrada(sessão([vínculo(BRF.id, ['DIRECTOR'])]))).toBe(
      `/app/companies/${BRF.id}/dashboard`,
    );
  });

  it('deve levar o Executor direto à Área de Execução', () => {
    expect(rotaDeEntrada(sessão([vínculo(BRF.id, ['EXECUTOR'])]))).toBe('/app/execution');
  });

  it('deve preferir o contexto mais alto quando a pessoa acumula papéis', () => {
    // Quem é Engenheiro da Consultoria e também Executor tem uma carteira para
    // administrar; cair na fila de tarefas seria entrar pela porta menor.
    const acumulado = [vínculo(BRF.id, ['CONSULTANT_ENGINEER', 'EXECUTOR'])];
    expect(rotaDeEntrada(sessão(acumulado))).toBe('/app/dashboard');
  });

  it('deve ignorar vínculo desativado ao decidir a porta de entrada', () => {
    const desligadoDaBrf = [
      vínculo(BRF.id, ['MANAGER'], { isActive: false }),
      vínculo(SEARA.id, ['MANAGER']),
    ];
    expect(rotaDeEntrada(sessão(desligadoDaBrf))).toBe(`/app/companies/${SEARA.id}/dashboard`);
  });

  it('deve mandar para o perfil quem entrou sem vínculo ativo nenhum', () => {
    // Acontece com quem foi desligado de todas as empresas mas ainda tem login.
    // Precisa de uma tela que exista, não de um dashboard vazio sem explicação.
    expect(rotaDeEntrada(sessão([]))).toBe('/app/profile');
  });
});
