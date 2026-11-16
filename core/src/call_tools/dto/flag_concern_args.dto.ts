import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
} from 'class-validator';

export class FlagConcernArgsDto {
  @IsIn(['SCAM_COACHING', 'VULNERABILITY'])
  type: 'SCAM_COACHING' | 'VULNERABILITY';

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  quotes: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  signals?: string[];
}
