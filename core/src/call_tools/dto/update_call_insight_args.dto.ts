import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

import { CallSentiment } from '../../calls/types/call_row.type';

export class UpdateCallInsightArgsDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  intent?: string;

  @IsOptional()
  @IsIn(['POSITIVE', 'NEUTRAL', 'NEGATIVE', 'DISTRESSED'])
  sentiment?: CallSentiment;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  summary?: string;
}
