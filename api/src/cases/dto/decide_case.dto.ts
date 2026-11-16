import {
  IsIn,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
} from 'class-validator';

import { SELECTABLE_REASON_CODES } from '../constants/reason_code.constant';

export const CASE_DECISIONS = [
  'APPROVED',
  'EDITED_AND_APPROVED',
  'REJECTED',
] as const;
export type CaseDecision = (typeof CASE_DECISIONS)[number];

export class DecideCaseDto {
  @IsString()
  @IsNotEmpty()
  staff_id: string;

  @IsIn(CASE_DECISIONS)
  decision: CaseDecision;

  @IsIn(SELECTABLE_REASON_CODES)
  reason_code: string;

  @IsOptional()
  @IsObject()
  edited_params?: Record<string, unknown>;
}
