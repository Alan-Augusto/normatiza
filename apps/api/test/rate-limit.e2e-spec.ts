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

  it('deve bloquear a enxurrada de tentativas de senha', async () => {
    // Sem isto, o Argon2id encarece cada tentativa mas não o volume: um
    // atacante testa milhares de senhas contra um e-mail que ele conhece.
    const status: number[] = [];
    for (let i = 0; i <= LIMITE_DE_CREDENCIAL.limit; i++) {
      const res = await http()
        .post('/auth/login')
        .send({ email: elenco.marcos.email, password: `chute-${i}` });
      status.push(res.status);
    }

    expect(status.filter((s) => s === 401)).toHaveLength(LIMITE_DE_CREDENCIAL.limit);
    expect(status[status.length - 1]).toBe(429);
  });

  it('deve bloquear a enxurrada de pedidos de redefinição de senha', async () => {
    // Sem limite, a rota vira uma máquina de mandar e-mail para qualquer pessoa.
    let última = 0;

    for (let i = 0; i <= LIMITE_DE_CREDENCIAL.limit; i++) {
      const res = await http()
        .post('/auth/forgot-password')
        .send({ email: elenco.marcos.email });
      última = res.status;
    }

    expect(última).toBe(429);
  });
});
