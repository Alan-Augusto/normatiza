import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';
import { MENSAGEM_SENHA_CURTA, SENHA_MINIMA } from '@normatiza/shared';
import type {
  AcceptInvitationRequest,
  ForgotPasswordRequest,
  LoginRequest,
  ResetPasswordRequest,
} from '@normatiza/shared';

// O mínimo e a frase vêm do pacote compartilhado: o formulário do front precisa
// recusar exatamente o que o servidor recusaria, com o mesmo número.
export { SENHA_MINIMA };

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
  @MinLength(SENHA_MINIMA, { message: MENSAGEM_SENHA_CURTA })
  password: string;
}

export class AcceptInvitationDto implements AcceptInvitationRequest {
  @IsString()
  token: string;

  @IsString()
  @MinLength(SENHA_MINIMA, { message: MENSAGEM_SENHA_CURTA })
  password: string;
}
