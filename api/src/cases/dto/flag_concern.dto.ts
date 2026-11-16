import { IsArray, IsIn, IsOptional, IsString, IsUUID } from 'class-validator';

export const CONCERN_TYPES = ['SCAM_COACHING', 'VULNERABILITY'] as const;
export type ConcernType = (typeof CONCERN_TYPES)[number];

export class FlagConcernDto {
  @IsUUID()
  call_id: string;

  @IsIn(CONCERN_TYPES)
  type: ConcernType;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  quotes?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  signals?: string[];
}
