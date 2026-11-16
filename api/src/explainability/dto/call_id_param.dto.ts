import { IsUUID } from 'class-validator';

export class CallIdParamDto {
  @IsUUID()
  call_id: string;
}
