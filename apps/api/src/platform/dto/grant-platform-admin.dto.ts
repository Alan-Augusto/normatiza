import { IsString } from 'class-validator';
import type { GrantPlatformAdminRequest } from '@normatiza/shared';

export class GrantPlatformAdminDto implements GrantPlatformAdminRequest {
  @IsString()
  userId: string;
}
