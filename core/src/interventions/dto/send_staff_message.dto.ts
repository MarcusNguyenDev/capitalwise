import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class SendStaffMessageDto {
  @IsString()
  staff_id: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  text: string;
}
