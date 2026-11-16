import {
  ArrayNotEmpty,
  IsArray,
  IsIn,
  IsNotEmpty,
  IsString,
} from 'class-validator';

import { SELECTABLE_REASON_CODES } from '../../cases/constants/reason_code.constant';

export class BatchApproveDto {
  @IsString()
  @IsNotEmpty()
  staff_id: string;

  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  case_numbers: string[];

  @IsIn(SELECTABLE_REASON_CODES)
  reason_code: string;
}
