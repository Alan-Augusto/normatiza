import { Injectable } from '@nestjs/common';
import { PasswordAlgo } from '@prisma/client';

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

@Injectable()
export class PasswordService {
  /** Sempre Argon2id. O esquema do legado nunca é usado para gerar senha nova. */
  hash(_plain: string): Promise<string> {
    throw new Error('PasswordService.hash não implementado');
  }

  /**
   * Verifica a senha contra o que estiver guardado — Argon2id ou o SHA-256 do
   * legado. Nunca lança por senha errada: devolve `valid: false`.
   */
  verify(_stored: StoredPassword, _plain: string): Promise<PasswordVerification> {
    throw new Error('PasswordService.verify não implementado');
  }
}
