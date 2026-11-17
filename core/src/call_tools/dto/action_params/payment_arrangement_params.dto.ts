import { Type } from 'class-transformer';
import {
  IsInt,
  IsNumber,
  IsOptional,
  Matches,
  Max,
  Min,
} from 'class-validator';

import { ACCOUNT_ID_PATTERN } from '../../constants/id_patterns.constant';

export class PaymentArrangementParamsDto {
  @Matches(ACCOUNT_ID_PATTERN, {
    message: 'account_id must look like ACC-10011',
  })
  account_id: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  weeks: number;

  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  @Min(0)
  amount?: number;
}
