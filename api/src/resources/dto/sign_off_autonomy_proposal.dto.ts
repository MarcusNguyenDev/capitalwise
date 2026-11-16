import { IsNotEmpty, IsString } from 'class-validator';

export class SignOffAutonomyProposalDto {
  @IsString()
  @IsNotEmpty()
  staff_id: string;
}
