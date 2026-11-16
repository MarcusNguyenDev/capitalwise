import { IsNotEmpty, IsString } from 'class-validator';

export class CreateAutonomyProposalDto {
  @IsString()
  @IsNotEmpty()
  staff_id: string;

  @IsString()
  @IsNotEmpty()
  action_code: string;
}
