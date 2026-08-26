import {
  ArrayNotEmpty,
  IsArray,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import type { CreateInvitationRequest, ExecutorType, Role } from '@normatiza/shared';

const PAPÉIS: Role[] = [
  'SYSTEM_ADMIN',
  'LEAD_ENGINEER',
  'CONSULTANT_ENGINEER',
  'TECHNICIAN',
  'MANAGER',
  'CLIENT_ENGINEER',
  'DIRECTOR',
  'EXECUTOR',
];

export class CreateInvitationDto implements CreateInvitationRequest {
  @IsString()
  @MaxLength(120)
  name: string;

  @IsEmail({}, { message: 'Informe um e-mail válido.' })
  email: string;

  /**
   * Aqui só se verifica que o papel **existe**. Se quem convida *pode* concedê-lo
   * é decisão de autorização, não de formato — vive no `PermissionService`.
   */
  @IsArray()
  @ArrayNotEmpty({ message: 'Informe ao menos um papel.' })
  @IsEnum(PAPÉIS, { each: true })
  roles: Role[];

  @IsArray()
  @ArrayNotEmpty({ message: 'Informe ao menos uma empresa.' })
  @IsString({ each: true })
  companyIds: string[];

  @IsOptional()
  @IsEnum(['INTERNAL', 'THIRD_PARTY'])
  executorType?: ExecutorType;

  @IsOptional()
  @IsString()
  jobTitle?: string;

  @IsOptional()
  @IsString()
  phone?: string;
}
