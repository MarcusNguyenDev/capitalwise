import { IsUUID } from 'class-validator';

export class SendIdentityCheckDto {
  @IsUUID()
  call_id: string;
}
