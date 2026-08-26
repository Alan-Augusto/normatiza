import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';
import type {
  AcceptInvitationRequest,
  ForgotPasswordRequest,
  LoginRequest,
  ResetPasswordRequest,
} from '@normatiza/shared';

/**
 * Tamanho mínimo de senha. Regra de composição (maiúscula, símbolo, dígito) fica
 * de fora de propósito: obriga a senha ruim e memorizável. Comprimento é o que
 * mede resistência.
 */
export const SENHA_MINIMA = 10;

/** `implements` é o que garante que a validação e o contrato não se separem. */
export class LoginDto implements LoginRequest {
  @IsEmail({}, { message: 'Informe um e-mail válido.' })
  email: string;

  @IsString()
  password: string;

  /** Só na segunda tentativa, quando o e-mail existe em mais de uma consultoria. */
  @IsOptional()
  @IsString()
  accountId?: string;
}

export class ForgotPasswordDto implements ForgotPasswordRequest {
  @IsEmail({}, { message: 'Informe um e-mail válido.' })
  email: string;
}

export class ResetPasswordDto implements ResetPasswordRequest {
  @IsString()
  token: string;

  @IsString()
  @MinLength(SENHA_MINIMA, { message: `A senha precisa de ao menos ${SENHA_MINIMA} caracteres.` })
  password: string;
}

export class AcceptInvitationDto implements AcceptInvitationRequest {
  @IsString()
  token: string;

  @IsString()
  @MinLength(SENHA_MINIMA, { message: `A senha precisa de ao menos ${SENHA_MINIMA} caracteres.` })
  password: string;
}
