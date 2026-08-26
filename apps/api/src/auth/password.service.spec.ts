import { createHash, randomBytes } from 'node:crypto';

import { PasswordService } from './password.service';

/**
 * Emula o hash do sistema legado — `APICore.Model.Authorization.Auth`:
 * SHA-256 sobre (salt de 32 bytes ‖ bytes da senha).
 *
 * A codificação da senha era `Encoding.Default`, que depende do sistema
 * operacional onde a API rodava. Para senha ASCII dá no mesmo; para senha com
 * acento, não — daí o parâmetro.
 */
function hashLegado(senha: string, salt: Buffer, codificacao: BufferEncoding = 'utf8') {
  return createHash('sha256')
    .update(Buffer.concat([salt, Buffer.from(senha, codificacao)]))
    .digest('base64');
}

describe('PasswordService', () => {
  let service: PasswordService;

  beforeEach(() => {
    service = new PasswordService();
  });

  describe('senhas novas', () => {
    it('deve aceitar a senha correta de um usuário cadastrado no sistema novo', async () => {
      const hash = await service.hash('senha-do-marcos');

      const resultado = await service.verify(
        { hash, algo: 'ARGON2ID' },
        'senha-do-marcos',
      );

      expect(resultado.valid).toBe(true);
      expect(resultado.mustRehash).toBe(false);
    });

    it('deve recusar a senha errada', async () => {
      const hash = await service.hash('senha-do-marcos');

      const resultado = await service.verify({ hash, algo: 'ARGON2ID' }, 'chute');

      expect(resultado.valid).toBe(false);
    });

    it('deve gerar hashes diferentes para a mesma senha', async () => {
      // Sem isso, duas pessoas com a mesma senha teriam o mesmo hash — e quebrar
      // uma quebraria as duas.
      const [a, b] = await Promise.all([service.hash('123456'), service.hash('123456')]);

      expect(a).not.toEqual(b);
    });

    it('deve recusar a autenticação de quem ainda não definiu senha', async () => {
      // Usuário convidado: existe, mas não tem credencial.
      const resultado = await service.verify({ hash: null, algo: null }, 'qualquer-coisa');

      expect(resultado.valid).toBe(false);
    });
  });

  describe('senhas vindas do sistema legado', () => {
    const salt = randomBytes(32);

    it('deve aceitar a senha correta de um usuário migrado', async () => {
      const resultado = await service.verify(
        {
          hash: hashLegado('senha-antiga', salt),
          algo: 'LEGACY_SHA256',
          legacySalt: salt.toString('base64'),
        },
        'senha-antiga',
      );

      expect(resultado.valid).toBe(true);
    });

    it('deve exigir a reescrita do hash ao aceitar uma senha legada', async () => {
      // O legado é aceito uma única vez: no mesmo ato o hash vira Argon2id.
      const resultado = await service.verify(
        {
          hash: hashLegado('senha-antiga', salt),
          algo: 'LEGACY_SHA256',
          legacySalt: salt.toString('base64'),
        },
        'senha-antiga',
      );

      expect(resultado.mustRehash).toBe(true);
    });

    it('deve recusar a senha errada de um usuário migrado', async () => {
      const resultado = await service.verify(
        {
          hash: hashLegado('senha-antiga', salt),
          algo: 'LEGACY_SHA256',
          legacySalt: salt.toString('base64'),
        },
        'senha-errada',
      );

      expect(resultado.valid).toBe(false);
      expect(resultado.mustRehash).toBe(false);
    });

    it('deve aceitar senha com acento gravada em codificação de sistema Windows', async () => {
      // `Encoding.Default` no .NET Framework é a página ANSI da máquina. Se a
      // API antiga rodava em Windows pt-BR, "manutenção" foi gravada em
      // latin1 — e recusar essa pessoa seria trancá-la para fora por causa de
      // um detalhe de hospedagem que ela não escolheu.
      const resultado = await service.verify(
        {
          hash: hashLegado('manutenção', salt, 'latin1'),
          algo: 'LEGACY_SHA256',
          legacySalt: salt.toString('base64'),
        },
        'manutenção',
      );

      expect(resultado.valid).toBe(true);
    });

    it('deve recusar hash legado sem o salt correspondente', async () => {
      // Registro migrado pela metade não vira porta aberta.
      const resultado = await service.verify(
        { hash: hashLegado('senha-antiga', salt), algo: 'LEGACY_SHA256', legacySalt: null },
        'senha-antiga',
      );

      expect(resultado.valid).toBe(false);
    });
  });
});
