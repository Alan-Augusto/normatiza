import { plainToInstance } from 'class-transformer';
import {
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MinLength,
  validateSync,
} from 'class-validator';

export enum Environment {
  Development = 'development',
  Test = 'test',
  Production = 'production',
}

/** Formato aceito pelo `expiresIn` do @nestjs/jwt: `900`, `15m`, `30d`. */
const DURATION = /^\d+(ms|s|m|h|d)?$/;

export class EnvironmentVariables {
  @IsEnum(Environment)
  @IsOptional()
  NODE_ENV: Environment = Environment.Development;

  @IsString()
  @Matches(/^postgres(ql)?:\/\//, {
    message: 'DATABASE_URL deve ser uma connection string PostgreSQL.',
  })
  DATABASE_URL: string;

  /**
   * Obrigatória apenas quando a suíte de testes roda contra banco real.
   * A validação de "não pode ser igual à DATABASE_URL" está em `validate`.
   */
  @IsOptional()
  @IsString()
  @Matches(/^postgres(ql)?:\/\//, {
    message: 'TEST_DATABASE_URL deve ser uma connection string PostgreSQL.',
  })
  TEST_DATABASE_URL?: string;

  @IsString()
  @MinLength(32, {
    message: 'JWT_ACCESS_SECRET precisa de ao menos 32 caracteres.',
  })
  JWT_ACCESS_SECRET: string;

  @IsString()
  @MinLength(32, {
    message: 'JWT_REFRESH_SECRET precisa de ao menos 32 caracteres.',
  })
  JWT_REFRESH_SECRET: string;

  @IsOptional()
  @Matches(DURATION, { message: 'JWT_ACCESS_TTL deve ser algo como `15m`.' })
  JWT_ACCESS_TTL: string = '15m';

  @IsOptional()
  @Matches(DURATION, { message: 'JWT_REFRESH_TTL deve ser algo como `30d`.' })
  JWT_REFRESH_TTL: string = '30d';

  /**
   * `true` quando o front e a API vivem em sites diferentes — o caso dos
   * ambientes de preview (`*.web.app` + URL do Cloud Run). Aí o cookie do
   * refresh token exige `SameSite=None; Secure`.
   *
   * Com domínios irmãos em produção (`admin.` e `api.` do mesmo domínio) fica
   * `false`, e o cookie é `SameSite=Lax` — mais restrito, e o suficiente.
   */
  @IsOptional()
  @IsIn(['true', 'false'])
  COOKIE_CROSS_SITE: string = 'false';

  // ── E-mail ──────────────────────────────────────────────────────────────────

  /**
   * `console` imprime o e-mail no log, com o link, e **não envia nada**. É o
   * padrão porque o elenco de testes e o seed usam endereços de domínios que não
   * existem: disparar para eles produz *hard bounces*, e reputação de remetente
   * queimada não se conserta com deploy.
   */
  @IsOptional()
  @IsIn(['console', 'resend'])
  MAIL_TRANSPORT: string = 'console';

  @IsOptional()
  @IsString()
  RESEND_API_KEY?: string;

  @IsOptional()
  @IsString()
  MAIL_FROM: string = 'Normatiza <onboarding@resend.dev>';

  /**
   * Endereços que podem receber de verdade fora de produção, separados por
   * vírgula. **Sem esta lista, fora de produção, nada é enviado** — o padrão
   * seguro é o silêncio: "não enviei" se conserta com uma variável, "enviei para
   * o cliente errado" não se conserta.
   */
  @IsOptional()
  @IsString()
  MAIL_ALLOWLIST?: string;

  /** Raiz do painel web, usada para montar os links dos e-mails. */
  @IsOptional()
  @IsString()
  APP_URL: string = 'http://localhost:8080';

  // ── Arquivos ────────────────────────────────────────────────────────────────

  /**
   * `local` grava em disco, na pasta `STORAGE_LOCAL_DIR`, e é o padrão: o
   * desenvolvimento não depende de credencial nenhuma para enviar um logo.
   * `firebase` é o storage de verdade (docs/produto/05 §4).
   */
  @IsOptional()
  @IsIn(['local', 'firebase'], { message: 'STORAGE_DRIVER deve ser `local` ou `firebase`.' })
  STORAGE_DRIVER: string = 'local';

  @IsOptional()
  @IsString()
  STORAGE_LOCAL_DIR: string = '.storage';

  @IsOptional()
  @IsString()
  FIREBASE_PROJECT_ID?: string;

  @IsOptional()
  @IsString()
  FIREBASE_CLIENT_EMAIL?: string;

  /** A chave PEM da conta de serviço, com as quebras de linha escritas como `\n`. */
  @IsOptional()
  @IsString()
  FIREBASE_PRIVATE_KEY?: string;

  @IsOptional()
  @IsString()
  FIREBASE_STORAGE_BUCKET?: string;

  @IsOptional()
  @IsInt()
  PORT: number = 3000;
}

/**
 * Roda no boot, antes de qualquer módulo subir. Se algo obrigatório faltar ou
 * estiver malformado, a aplicação **não sobe** — falha barulhenta na largada é
 * preferível a um 500 silencioso na primeira autenticação.
 */
export function validate(raw: Record<string, unknown>): EnvironmentVariables {
  const config = plainToInstance(EnvironmentVariables, raw, {
    enableImplicitConversion: true,
    exposeDefaultValues: true,
  });

  const errors = validateSync(config, { skipMissingProperties: false });

  if (errors.length > 0) {
    const detalhes = errors
      .map((e) => `  - ${e.property}: ${Object.values(e.constraints ?? {}).join('; ')}`)
      .join('\n');
    throw new Error(`Variáveis de ambiente inválidas:\n${detalhes}`);
  }

  if (config.JWT_ACCESS_SECRET === config.JWT_REFRESH_SECRET) {
    throw new Error(
      'JWT_ACCESS_SECRET e JWT_REFRESH_SECRET devem ser diferentes: um access token ' +
        'não pode ser aceito como refresh token.',
    );
  }

  if (config.NODE_ENV === Environment.Test) {
    if (!config.TEST_DATABASE_URL) {
      throw new Error(
        'TEST_DATABASE_URL é obrigatória quando NODE_ENV=test — a suíte trunca as ' +
          'tabelas e não pode apontar para o banco de desenvolvimento.',
      );
    }
    if (config.TEST_DATABASE_URL === config.DATABASE_URL) {
      throw new Error(
        'TEST_DATABASE_URL não pode ser igual à DATABASE_URL: use uma branch ' +
          'dedicada no Neon.',
      );
    }
  }

  if (config.MAIL_TRANSPORT === 'resend' && !config.RESEND_API_KEY) {
    throw new Error(
      'MAIL_TRANSPORT=resend exige RESEND_API_KEY. Sem a chave, nada seria enviado ' +
        'e a falha só apareceria quando alguém reclamasse de não receber o convite.',
    );
  }

  if (
    config.MAIL_TRANSPORT === 'resend' &&
    config.NODE_ENV !== Environment.Production &&
    !config.MAIL_ALLOWLIST
  ) {
    throw new Error(
      'MAIL_TRANSPORT=resend fora de produção exige MAIL_ALLOWLIST. O seed e o ' +
        'elenco de testes usam endereços de domínios inexistentes, e enviar para ' +
        'eles queima a reputação do domínio remetente.',
    );
  }

  if (config.STORAGE_DRIVER === 'firebase') {
    const faltando = (
      [
        'FIREBASE_PROJECT_ID',
        'FIREBASE_CLIENT_EMAIL',
        'FIREBASE_PRIVATE_KEY',
        'FIREBASE_STORAGE_BUCKET',
      ] as const
    ).filter((chave) => !config[chave]);

    if (faltando.length) {
      throw new Error(
        `STORAGE_DRIVER=firebase exige ${faltando.join(', ')}. Sem elas a API subiria ` +
          'e o primeiro upload falharia na mão de quem estivesse cadastrando a empresa.',
      );
    }
  }

  return config;
}
