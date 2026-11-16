import { IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class HumanJoinedDto {
  @IsUUID()
  call_id: string;

  @IsString()
  @IsNotEmpty()
  staff_id: string;
}
