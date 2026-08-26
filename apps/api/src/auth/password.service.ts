import { createHash, timingSafeEqual } from 'node:crypto';

import { Injectable } from '@nestjs/common';
import { PasswordAlgo } from '@prisma/client';
import * as argon2 from 'argon2';

/** A credencial como está guardada no `User`. */
export interface StoredPassword {
  hash: string | null;
  algo: PasswordAlgo | null;
  /** Salt de 32 bytes do legado, em base64. Só existe com `LEGACY_SHA256`. */
  legacySalt?: string | null;
}

export interface PasswordVerification {
  valid: boolean;
  /**
   * Verdadeiro quando a senha confere mas o hash precisa ser reescrito — hash
   * legado aceito pela primeira vez, ou Argon2id com parâmetros antigos.
   */
  mustRehash: boolean;
}

/**
 * Parâmetros do Argon2id. Subir `memoryCost` é o que encarece o ataque por GPU;
 * os valores seguem a recomendação do OWASP (19 MiB, 2 iterações).
 *
 * Mudá-los não invalida senha nenhuma: `needsRehash` detecta o hash antigo e o
 * próximo login o reescreve.
 */
const ARGON2_OPTIONS = {
  type: argon2.argon2id as 2,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
};

/**
 * Codificações que o `Encoding.Default` do .NET pode ter usado no sistema
 * antigo. Para senha ASCII as duas dão o mesmo resultado; para senha com acento,
 * não — e a pessoa não escolheu em que sistema operacional a API rodava.
 */
const CODIFICAÇÕES_DO_LEGADO: BufferEncoding[] = ['utf8', 'latin1'];

@Injectable()
export class PasswordService {
  /** Sempre Argon2id. O esquema do legado nunca é usado para gerar senha nova. */
  hash(plain: string): Promise<string> {
    return argon2.hash(plain, ARGON2_OPTIONS);
  }

  /**
   * Verifica a senha contra o que estiver guardado — Argon2id ou o SHA-256 do
   * legado. Nunca lança por senha errada: devolve `valid: false`.
   */
  async verify(stored: StoredPassword, plain: string): Promise<PasswordVerification> {
    // Usuário convidado que ainda não definiu senha: existe, mas não autentica.
    if (!stored.hash || !stored.algo) {
      return { valid: false, mustRehash: false };
    }

    if (stored.algo === 'LEGACY_SHA256') {
      const valid = this.verificaLegado(stored, plain);
      return { valid, mustRehash: valid };
    }

    try {
      const valid = await argon2.verify(stored.hash, plain);
      return {
        valid,
        mustRehash: valid && argon2.needsRehash(stored.hash, ARGON2_OPTIONS),
      };
    } catch {
      // Hash corrompido ou em formato desconhecido não é motivo para deixar entrar.
      return { valid: false, mustRehash: false };
    }
  }

  /**
   * Reproduz `APICore.Model.Authorization.Auth`: SHA-256 sobre
   * (salt de 32 bytes ‖ bytes da senha).
   */
  private verificaLegado(stored: StoredPassword, plain: string): boolean {
    // Registro migrado pela metade não vira porta aberta.
    if (!stored.legacySalt) return false;

    const salt = Buffer.from(stored.legacySalt, 'base64');
    const esperado = Buffer.from(stored.hash as string, 'base64');

    return CODIFICAÇÕES_DO_LEGADO.some((codificação) => {
      const calculado = createHash('sha256')
        .update(Buffer.concat([salt, Buffer.from(plain, codificação)]))
        .digest();

      return (
        calculado.length === esperado.length && timingSafeEqual(calculado, esperado)
      );
    });
  }
}
