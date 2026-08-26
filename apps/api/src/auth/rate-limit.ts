import { Throttle } from '@nestjs/throttler';

const UM_MINUTO = 60_000;

/**
 * Limites das rotas de credencial.
 *
 * Rate limiting aqui não é sobre carga: é o que separa "senha forte" de "senha
 * forte o suficiente". Sem ele, um atacante testa milhões de senhas contra um
 * e-mail conhecido, e o Argon2id só encarece cada tentativa — não o volume.
 */
export const LIMITE_DE_CREDENCIAL = { limit: 10, ttl: UM_MINUTO };

/** O refresh é legítimo e frequente: um app com várias abas renova em rajada. */
export const LIMITE_DE_REFRESH = { limit: 60, ttl: UM_MINUTO };

export const RateLimitCredencial = () => Throttle({ default: LIMITE_DE_CREDENCIAL });
export const RateLimitRefresh = () => Throttle({ default: LIMITE_DE_REFRESH });
