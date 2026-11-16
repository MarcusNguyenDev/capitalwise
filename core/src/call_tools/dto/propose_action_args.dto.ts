import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

import { PROPOSABLE_ACTION_CODES } from '../constants/proposable_action_codes.constant';

export class SoftSignalsArgsDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  vulnerability_signals?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  scam_coaching_signals?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  quotes?: string[];
}

export class ProposeActionArgsDto {
  @IsIn(PROPOSABLE_ACTION_CODES)
  action_code: string;

  @IsObject()
  params: Record<string, unknown>;

  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  summary: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  customer_statement?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => SoftSignalsArgsDto)
  soft_signals?: SoftSignalsArgsDto;
}
