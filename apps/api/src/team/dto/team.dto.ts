import {
  ArrayNotEmpty,
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import type {
  ChangePasswordRequest,
  DisableUserRequest,
  ExecutorType,
  RegistryType,
  Role,
  TeamListQuery,
  UpdateMembershipRequest,
  UpdateProfileRequest,
  UserStatus,
} from '@normatiza/shared';

import { SENHA_MINIMA } from '../../auth/dto/auth.dto';

const PAPÉIS: Role[] = [
  'LEAD_ENGINEER',
  'CONSULTANT_ENGINEER',
  'TECHNICIAN',
  'MANAGER',
  'CLIENT_ENGINEER',
  'DIRECTOR',
  'EXECUTOR',
];

export class TeamListQueryDto implements TeamListQuery {
  @IsOptional()
  @IsEnum(PAPÉIS)
  role?: Role;

  @IsOptional()
  @IsString()
  companyId?: string;

  @IsOptional()
  @IsEnum(['INVITED', 'ACTIVE', 'DISABLED'])
  status?: UserStatus;
}

/**
 * Aqui só se verifica que o papel **existe**. Se quem promove *pode* concedê-lo
 * é decisão de autorização, não de formato — vive no `MemberPolicyService`.
 */
export class UpdateMembershipDto implements UpdateMembershipRequest {
  @IsArray()
  @ArrayNotEmpty({ message: 'Informe ao menos um papel.' })
  @IsEnum(PAPÉIS, { each: true })
  roles: Role[];

  @IsOptional()
  @IsEnum(['INTERNAL', 'THIRD_PARTY'])
  executorType?: ExecutorType;
}

export class DisableUserDto implements DisableUserRequest {
  /** Exigido só quando o *preview* disser que a saída quebra algo (D4). */
  @IsOptional()
  @IsString()
  successorUserId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

/**
 * **Não tem `email`, e não pode ganhar** (D7).
 *
 * Com `forbidNonWhitelisted` ligado no pipe global, um corpo que traga `email`
 * é recusado em vez de silenciosamente ignorado — a pessoa fica sabendo que
 * aquele caminho não existe, em vez de achar que funcionou.
 */
export class UpdateProfileDto implements UpdateProfileRequest {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  jobTitle?: string;

  @IsOptional()
  @IsEnum(['CREA', 'CFT'])
  registryType?: RegistryType;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  registryNumber?: string;
}

export class ChangePasswordDto implements ChangePasswordRequest {
  @IsString()
  currentPassword: string;

  @IsString()
  @MinLength(SENHA_MINIMA, { message: `A senha precisa de ao menos ${SENHA_MINIMA} caracteres.` })
  newPassword: string;
}
