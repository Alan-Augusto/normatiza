import { Transform } from 'class-transformer';
import { IsEmail, IsOptional, IsString } from 'class-validator';
import type { GrantPlatformAdminRequest } from '@normatiza/shared';

export class GrantPlatformAdminDto implements GrantPlatformAdminRequest {
  /**
   * Aparado **antes** de validar, e não depois.
   *
   * `@IsEmail` é ancorado: `"  fulano@x.com "` reprova. Aparar só na hora de
   * consultar chegaria tarde — a recusa já teria acontecido, e com a mensagem
   * mais enganosa possível, porque quem colou está olhando para o endereço
   * certo enquanto lê que ele é inválido.
   */
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsEmail({}, { message: 'Informe um e-mail válido.' })
  email: string;

  /** Só na segunda tentativa, quando o e-mail alcançou mais de uma pessoa. */
  @IsOptional()
  @IsString()
  userId?: string;
}
