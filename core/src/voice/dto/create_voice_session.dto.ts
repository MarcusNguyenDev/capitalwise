import { IsUUID } from 'class-validator';

export class CreateVoiceSessionDto {
  @IsUUID()
  call_id: string;
}
