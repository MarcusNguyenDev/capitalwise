import { IsUUID } from 'class-validator';

export class IdentityCallParamDto {
  @IsUUID()
  call_id: string;
}
