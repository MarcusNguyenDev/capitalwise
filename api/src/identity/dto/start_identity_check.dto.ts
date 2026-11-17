import { IsIn, IsUUID } from 'class-validator';

export const IDENTITY_CHECK_LEVELS = [1, 2] as const;

export class StartIdentityCheckDto {
  @IsUUID()
  call_id: string;

  @IsIn(IDENTITY_CHECK_LEVELS)
  level: 1 | 2;
}
