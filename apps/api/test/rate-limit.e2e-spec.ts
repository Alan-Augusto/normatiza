import * as request from 'supertest';

import { Elenco, SENHA_PADRÃO, montarElenco } from './helpers/elenco';
import { TestApp, createTestApp } from './helpers/test-app';
import { LIMITE_DE_CREDENCIAL } from '../src/auth/rate-limit';

/**
 * Rate limiting nas rotas de credencial.
 *
 * O resto da suíte roda com o limite desligado — dezenas de logins em segundos
 * tropeçariam nele. Aqui ele é religado de propósito: um limite que só existe
 * na configuração e nunca é exercitado não é proteção, é intenção.
 */
describe('Rate limiting (e2e)', () => {
  let ctx: TestApp;
  let elenco: Elenco;

  const http = () => request(ctx.app.getHttpServer());

  beforeAll(async () => {
    process.env.THROTTLE_DISABLED = 'false';
    ctx = await createTestApp();
  });

  afterAll(async () => {
    await ctx.close();
    process.env.THROTTLE_DISABLED = 'true';
  });

  beforeEach(async () => {
    elenco = await montarElenco(ctx.prisma);
  });

  /**
   * As tentativas vão **em paralelo**, e não em fila.
   *
   * O limite é de 10 por minuto: em fila, os onze pedidos precisariam caber
   * dentro da janela de 60 segundos, e um dia de latência ruim no banco faria o
   * primeiro deles expirar antes do último chegar — o teste falharia sem nada
   * ter quebrado. Disparados juntos, todos caem na mesma janela por construção.
   */
  async function enxurrada(rota: string, corpo: (i: number) => object): Promise<number[]> {
    const tentativas = Array.from({ length: LIMITE_DE_CREDENCIAL.limit + 1 }, (_, i) =>
      http().post(rota).send(corpo(i)),
    );
    const respostas = await Promise.all(tentativas);
    return respostas.map((r) => r.status);
  }

  it('deve bloquear a enxurrada de tentativas de senha', async () => {
    // Sem isto, o Argon2id encarece cada tentativa mas não o volume: um
    // atacante testa milhares de senhas contra um e-mail que ele conhece.
    const status = await enxurrada('/auth/login', (i) => ({
      email: elenco.marcos.email,
      password: `chute-${i}`,
    }));

    expect(status).toContain(429);
    expect(status.filter((s) => s !== 429).length).toBeLessThanOrEqual(
      LIMITE_DE_CREDENCIAL.limit,
    );
  });

  it('deve bloquear a enxurrada de pedidos de redefinição de senha', async () => {
    // Sem limite, a rota vira uma máquina de mandar e-mail para qualquer pessoa.
    const status = await enxurrada('/auth/forgot-password', () => ({
      email: elenco.marcos.email,
    }));

    expect(status).toContain(429);
    expect(status.filter((s) => s !== 429).length).toBeLessThanOrEqual(
      LIMITE_DE_CREDENCIAL.limit,
    );
  });
});
