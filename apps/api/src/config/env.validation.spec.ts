import { validate } from './env.validation';

const ambienteMinimo = {
  DATABASE_URL: 'postgresql://user:pass@ep-x.aws.neon.tech/db?sslmode=require',
  JWT_ACCESS_SECRET: 'a'.repeat(48),
  JWT_REFRESH_SECRET: 'b'.repeat(48),
};

describe('Validação de ambiente', () => {
  it('deve aceitar um ambiente completo e aplicar os padrões de sessão', () => {
    const config = validate(ambienteMinimo);

    expect(config.JWT_ACCESS_TTL).toBe('15m');
    expect(config.JWT_REFRESH_TTL).toBe('30d');
    expect(config.PORT).toBe(3000);
  });

  it('deve impedir a aplicação de subir sem banco configurado', () => {
    const { DATABASE_URL, ...semBanco } = ambienteMinimo;

    expect(() => validate(semBanco)).toThrow(/DATABASE_URL/);
  });

  it('deve recusar um banco que não seja PostgreSQL', () => {
    expect(() =>
      validate({ ...ambienteMinimo, DATABASE_URL: 'mysql://user:pass@host/db' }),
    ).toThrow(/PostgreSQL/);
  });

  it('deve impedir a aplicação de subir sem os segredos de sessão', () => {
    const { JWT_ACCESS_SECRET, ...semSegredo } = ambienteMinimo;

    expect(() => validate(semSegredo)).toThrow(/JWT_ACCESS_SECRET/);
  });

  it('deve recusar segredo curto demais para assinar token', () => {
    expect(() => validate({ ...ambienteMinimo, JWT_ACCESS_SECRET: 'curto' })).toThrow(
      /32 caracteres/,
    );
  });

  it('deve recusar o mesmo segredo para access e refresh token', () => {
    const mesmo = 'c'.repeat(48);

    expect(() =>
      validate({
        ...ambienteMinimo,
        JWT_ACCESS_SECRET: mesmo,
        JWT_REFRESH_SECRET: mesmo,
      }),
    ).toThrow(/devem ser diferentes/);
  });

  it('deve recusar tempo de vida de token em formato inválido', () => {
    expect(() => validate({ ...ambienteMinimo, JWT_ACCESS_TTL: 'quinze minutos' })).toThrow(
      /JWT_ACCESS_TTL/,
    );
  });

  it('deve exigir banco de teste próprio quando o ambiente é de teste', () => {
    expect(() => validate({ ...ambienteMinimo, NODE_ENV: 'test' })).toThrow(
      /TEST_DATABASE_URL é obrigatória/,
    );
  });

  it('deve recusar que a suíte de teste aponte para o banco de desenvolvimento', () => {
    expect(() =>
      validate({
        ...ambienteMinimo,
        NODE_ENV: 'test',
        TEST_DATABASE_URL: ambienteMinimo.DATABASE_URL,
      }),
    ).toThrow(/não pode ser igual/);
  });
  describe('storage de arquivos', () => {
    const firebase = {
      FIREBASE_PROJECT_ID: 'normatiza-dev',
      FIREBASE_CLIENT_EMAIL: 'api@normatiza-dev.iam.gserviceaccount.com',
      FIREBASE_PRIVATE_KEY: '-----BEGIN PRIVATE KEY-----\\nabc\\n-----END PRIVATE KEY-----\\n',
      FIREBASE_STORAGE_BUCKET: 'normatiza-dev.appspot.com',
    };

    it('deve usar o disco local por padrão, sem exigir credencial nenhuma', () => {
      const config = validate(ambienteMinimo);

      expect(config.STORAGE_DRIVER).toBe('local');
    });

    it('deve aceitar o Firebase quando as quatro credenciais estão presentes', () => {
      expect(() =>
        validate({ ...ambienteMinimo, STORAGE_DRIVER: 'firebase', ...firebase }),
      ).not.toThrow();
    });

    it('deve impedir a aplicação de subir com Firebase sem credencial', () => {
      const { FIREBASE_PRIVATE_KEY, ...semChave } = firebase;

      expect(() =>
        validate({ ...ambienteMinimo, STORAGE_DRIVER: 'firebase', ...semChave }),
      ).toThrow(/FIREBASE_PRIVATE_KEY/);
    });

    describe('no emulador', () => {
      const emulador = {
        STORAGE_DRIVER: 'firebase',
        FIREBASE_PROJECT_ID: 'demo-normatiza-v2',
        FIREBASE_STORAGE_BUCKET: 'demo-normatiza-v2.appspot.com',
        FIREBASE_STORAGE_EMULATOR_HOST: '192.168.15.15:9199',
      };

      it('deve subir só com projeto e bucket, porque o emulador não confere credencial', () => {
        expect(() => validate({ ...ambienteMinimo, ...emulador })).not.toThrow();
      });

      it('deve recusar o endereço com protocolo, que o SDK rejeitaria no primeiro upload', () => {
        expect(() =>
          validate({
            ...ambienteMinimo,
            ...emulador,
            FIREBASE_STORAGE_EMULATOR_HOST: 'http://192.168.15.15:9199',
          }),
        ).toThrow(/FIREBASE_STORAGE_EMULATOR_HOST/);
      });

      it('deve impedir a produção de gravar no emulador sem que alguém tenha decidido isso', () => {
        expect(() =>
          validate({ ...ambienteMinimo, ...emulador, ...firebase, NODE_ENV: 'production' }),
        ).toThrow(/STORAGE_EMULATOR_IN_PRODUCTION/);
      });

      describe('num servidor provisório, com o emulador liberado', () => {
        const producao = {
          ...emulador,
          NODE_ENV: 'production',
          STORAGE_EMULATOR_IN_PRODUCTION: 'true',
        };

        it('deve subir quando a leitura sai por um endereço público HTTPS', () => {
          expect(() =>
            validate({
              ...ambienteMinimo,
              ...producao,
              FIREBASE_STORAGE_EMULATOR_PUBLIC_URL: 'https://normatiza.alanaugusto.dev/arquivos-emulador',
            }),
          ).not.toThrow();
        });

        it('deve exigir o endereço público, porque o do emulador só existe dentro da rede', () => {
          expect(() => validate({ ...ambienteMinimo, ...producao })).toThrow(
            /FIREBASE_STORAGE_EMULATOR_PUBLIC_URL/,
          );
        });

        it('deve recusar um endereço público HTTP, que a página HTTPS não carregaria', () => {
          expect(() =>
            validate({
              ...ambienteMinimo,
              ...producao,
              FIREBASE_STORAGE_EMULATOR_PUBLIC_URL: 'http://192.168.15.15:9199',
            }),
          ).toThrow(/https/);
        });
      });
    });

    it('deve recusar um driver de storage desconhecido', () => {
      expect(() => validate({ ...ambienteMinimo, STORAGE_DRIVER: 's3' })).toThrow(
        /STORAGE_DRIVER/,
      );
    });
  });
});
