import { Transform, Type } from 'class-transformer';
import {
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateNested,
  registerDecorator,
  type ValidationOptions,
} from 'class-validator';
import {
  BRAZIL_STATES,
  COMPANY_STATUS_ORDER,
  isValidCnpj,
  onlyDigits,
  type CompanyAddress,
  type CompanyContact,
  type CompanyListQuery,
  type CompanyStatus,
  type CompanyUpsertRequest,
} from '@normatiza/shared';

/**
 * Apara antes de validar. `Validators.email` e `@IsNotEmpty` são ancorados: um
 * espaço colado do e-mail ou um nome só de espaços passariam ou falhariam pelo
 * motivo errado — o D24 da Equipe já pegou esse defeito três vezes.
 */
const aparado = () =>
  Transform(({ value }) => (typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : value));

/** Opcional vazio é ausente: `""` no IE não é uma inscrição estadual. */
const opcional = () =>
  Transform(({ value }) => {
    if (typeof value !== 'string') return value;
    const limpo = value.replace(/\s+/g, ' ').trim();
    return limpo === '' ? undefined : limpo;
  });

const obrigatório = '$property é obrigatório.';

function IsCnpj(options?: ValidationOptions) {
  return (object: object, propertyName: string) =>
    registerDecorator({
      name: 'isCnpj',
      target: object.constructor,
      propertyName,
      options: { message: '$property não é um CNPJ válido.', ...options },
      validator: { validate: (value: unknown) => typeof value === 'string' && isValidCnpj(value) },
    });
}

export class CompanyContactDto implements CompanyContact {
  @aparado()
  @IsString()
  @IsNotEmpty({ message: obrigatório })
  @MaxLength(120)
  name: string;

  @opcional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  role?: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsNotEmpty({ message: obrigatório })
  @IsEmail({}, { message: '$property precisa ser um e-mail válido.' })
  email: string;

  @opcional()
  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @opcional()
  @IsOptional()
  @IsString()
  @MaxLength(30)
  mobile?: string;
}

export class CompanyAddressDto implements CompanyAddress {
  @Transform(({ value }) => (typeof value === 'string' ? onlyDigits(value) : value))
  @IsNotEmpty({ message: obrigatório })
  @Matches(/^\d{8}$/, { message: '$property precisa ter 8 dígitos.' })
  zipCode: string;

  @aparado()
  @IsString()
  @IsNotEmpty({ message: obrigatório })
  @MaxLength(200)
  street: string;

  @aparado()
  @IsString()
  @IsNotEmpty({ message: obrigatório })
  @MaxLength(20)
  number: string;

  @opcional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  complement?: string;

  @aparado()
  @IsString()
  @IsNotEmpty({ message: obrigatório })
  @MaxLength(120)
  district: string;

  @aparado()
  @IsString()
  @IsNotEmpty({ message: obrigatório })
  @MaxLength(120)
  city: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  @IsNotEmpty({ message: obrigatório })
  @IsIn(BRAZIL_STATES, { message: '$property precisa ser uma UF.' })
  state: string;
}

export class CompanyUpsertDto implements CompanyUpsertRequest {
  @aparado()
  @IsString()
  @IsNotEmpty({ message: obrigatório })
  @MaxLength(200)
  corporateName: string;

  @aparado()
  @IsString()
  @IsNotEmpty({ message: obrigatório })
  @MaxLength(120)
  tradeName: string;

  @IsNotEmpty({ message: obrigatório })
  @IsCnpj()
  document: string;

  @opcional()
  @IsOptional()
  @IsString()
  @MaxLength(30)
  stateRegistration?: string;

  @IsNotEmpty({ message: obrigatório })
  @ValidateNested()
  @Type(() => CompanyContactDto)
  contact: CompanyContactDto;

  @IsNotEmpty({ message: obrigatório })
  @ValidateNested()
  @Type(() => CompanyAddressDto)
  address: CompanyAddressDto;

  /** Vazio ou `null` tira a empresa do grupo. */
  @IsOptional()
  @IsString()
  @MaxLength(120)
  groupName?: string | null;

  @opcional()
  @IsOptional()
  @IsString()
  @MaxLength(60)
  externalCode?: string;

  @opcional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

export class CompanyListQueryDto implements CompanyListQuery {
  @opcional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  q?: string;

  @IsOptional()
  @IsIn([...COMPANY_STATUS_ORDER, 'ALL'])
  status?: CompanyStatus | 'ALL';
}

export class CompanyGroupQueryDto {
  @opcional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  q?: string;
}
