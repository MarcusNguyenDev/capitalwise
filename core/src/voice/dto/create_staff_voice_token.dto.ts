import { IsBoolean, IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class CreateStaffVoiceTokenDto {
  @IsUUID()
  call_id: string;

  @IsString()
  @IsNotEmpty()
  staff_id: string;

  // false: listen in (monitor); true: talk (only after a takeover).
  @IsBoolean()
  can_publish: boolean;
}
