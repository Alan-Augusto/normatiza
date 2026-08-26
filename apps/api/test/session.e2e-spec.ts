import { Elenco, montarElenco } from './helpers/elenco';
import { TestApp, createTestApp } from './helpers/test-app';
import { TokenService } from '../src/auth/token.service';

/**
 * Rotação de refresh token e detecção de reúso (D4, D7).
 *
 * Contra o banco real de propósito: reúso de token é, por definição, um fato de
 * persistência. Um mock diria o que eu mandasse dizer.
 */
describe('Sessão — rotação e revogação (e2e)', () => {
  let ctx: TestApp;
  let tokens: TokenService;
  let elenco: Elenco;

  beforeAll(async () => {
    ctx = await createTestApp();
    tokens = ctx.app.get(TokenService);
  });

  afterAll(async () => {
    await ctx.close();
  });

  beforeEach(async () => {
    elenco = await montarElenco(ctx.prisma);
  });

  const marcos = () => ({ id: elenco.marcos.id, accountId: elenco.normatiza.id });

  describe('o access token', () => {
    it('deve carregar a identidade e a conta explicitamente', async () => {
      // `accountId` explícito é o seguro que mantém reversível a decisão de
      // identidade por conta (D8).
      const { accessToken } = await tokens.issuePair(marcos());

      const claims = tokens.verifyAccessToken(accessToken);

      expect(claims.sub).toBe(elenco.marcos.id);
      expect(claims.accountId).toBe(elenco.normatiza.id);
    });

    it('deve expirar em quinze minutos', async () => {
      const { accessToken, expiresIn } = await tokens.issuePair(marcos());
      const claims = tokens.verifyAccessToken(accessToken);

      expect(expiresIn).toBe(15 * 60);
      expect(claims.exp - claims.iat).toBe(15 * 60);
    });

    it('deve recusar token adulterado', async () => {
      const { accessToken } = await tokens.issuePair(marcos());
      const adulterado = `${accessToken.slice(0, -4)}aaaa`;

      expect(() => tokens.verifyAccessToken(adulterado)).toThrow();
    });

    it('não deve aceitar um refresh token no lugar do access token', async () => {
      // Segredos diferentes para cada um justamente para que isso seja impossível.
      const { refreshToken } = await tokens.issuePair(marcos());

      expect(() => tokens.verifyAccessToken(refreshToken)).toThrow();
    });
  });

  describe('o refresh token', () => {
    it('deve guardar no banco apenas o hash, nunca o token em claro', async () => {
      const { refreshToken } = await tokens.issuePair(marcos());

      const guardados = await ctx.prisma.refreshToken.findMany();

      expect(guardados).toHaveLength(1);
      expect(guardados[0].tokenHash).not.toBe(refreshToken);
    });

    it('deve emitir um par novo a cada uso', async () => {
      const primeiro = await tokens.issuePair(marcos());

      const segundo = await tokens.rotate(primeiro.refreshToken);

      expect(segundo.refreshToken).not.toBe(primeiro.refreshToken);
      expect(segundo.accessToken).toEqual(expect.any(String));
    });

    it('deve invalidar o token anterior ao rotacionar', async () => {
      const primeiro = await tokens.issuePair(marcos());
      await tokens.rotate(primeiro.refreshToken);

      await expect(tokens.rotate(primeiro.refreshToken)).rejects.toThrow();
    });

    it('deve recusar token que nunca existiu', async () => {
      await expect(tokens.rotate('token-inventado')).rejects.toThrow();
    });

    it('deve recusar token expirado', async () => {
      const { refreshToken } = await tokens.issuePair(marcos());
      await ctx.prisma.refreshToken.updateMany({
        data: { expiresAt: new Date(Date.now() - 1000) },
      });

      await expect(tokens.rotate(refreshToken)).rejects.toThrow();
    });
  });

  describe('reúso de token — tratado como roubo', () => {
    it('deve derrubar a família inteira quando um token já usado reaparece', async () => {
      // Cenário real: o ladrão copiou o token, a vítima seguiu navegando. Não há
      // como saber quem é quem — derruba os dois e exige login novo.
      const primeiro = await tokens.issuePair(marcos());
      const segundo = await tokens.rotate(primeiro.refreshToken);
      const terceiro = await tokens.rotate(segundo.refreshToken);

      await expect(tokens.rotate(primeiro.refreshToken)).rejects.toThrow();

      // O token que ainda era válido morre junto.
      await expect(tokens.rotate(terceiro.refreshToken)).rejects.toThrow();
    });

    it('não deve derrubar as outras sessões do mesmo usuário', async () => {
      // Roubo no navegador de casa não pode desconectar o celular do trabalho.
      const navegador = await tokens.issuePair(marcos());
      const celular = await tokens.issuePair(marcos());

      await tokens.rotate(navegador.refreshToken);
      await expect(tokens.rotate(navegador.refreshToken)).rejects.toThrow();

      await expect(tokens.rotate(celular.refreshToken)).resolves.toBeDefined();
    });
  });

  describe('revogação', () => {
    it('deve derrubar todas as sessões do usuário desligado', async () => {
      const navegador = await tokens.issuePair(marcos());
      const celular = await tokens.issuePair(marcos());

      await tokens.revokeAllForUser(elenco.marcos.id, 'desligamento');

      await expect(tokens.rotate(navegador.refreshToken)).rejects.toThrow();
      await expect(tokens.rotate(celular.refreshToken)).rejects.toThrow();
    });

    it('deve encerrar apenas a sessão apresentada no logout', async () => {
      const navegador = await tokens.issuePair(marcos());
      const celular = await tokens.issuePair(marcos());

      await tokens.revoke(navegador.refreshToken);

      await expect(tokens.rotate(navegador.refreshToken)).rejects.toThrow();
      await expect(tokens.rotate(celular.refreshToken)).resolves.toBeDefined();
    });

    it('não deve derrubar a sessão de outro usuário', async () => {
      const doMarcos = await tokens.issuePair(marcos());
      const doAntonio = await tokens.issuePair({
        id: elenco.antonio.id,
        accountId: elenco.normatiza.id,
      });

      await tokens.revokeAllForUser(elenco.marcos.id, 'desligamento');

      await expect(tokens.rotate(doMarcos.refreshToken)).rejects.toThrow();
      await expect(tokens.rotate(doAntonio.refreshToken)).resolves.toBeDefined();
    });
  });
});
