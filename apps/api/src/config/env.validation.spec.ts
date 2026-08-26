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
});
