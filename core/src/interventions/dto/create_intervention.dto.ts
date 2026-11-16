import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

import { InterventionType } from '../types/intervention.type';

export class CreateInterventionDto {
  @IsString()
  staff_id: string;

  @IsIn(['MONITOR', 'INSTRUCTION', 'TAKEOVER', 'HANDBACK', 'END_CALL'])
  type: InterventionType;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  text?: string;
}
