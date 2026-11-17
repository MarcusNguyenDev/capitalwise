import { Transform, Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Matches, Max, Min } from 'class-validator';

import { ACCOUNT_ID_PATTERN } from '../../constants/id_patterns.constant';
import { normaliseCode } from './normalise_code.transform';

export const ARRANGEMENT_TYPES = [
  'REPAYMENT_PAUSE',
  'REDUCED_REPAYMENTS',
  'TERM_EXTENSION',
] as const;

export class HardshipRequestParamsDto {
  @Matches(ACCOUNT_ID_PATTERN, {
    message: 'account_id must look like ACC-10031',
  })
  account_id: string;

  @Transform(normaliseCode)
  @IsOptional()
  @IsIn(ARRANGEMENT_TYPES)
  arrangement_type?: (typeof ARRANGEMENT_TYPES)[number];

  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(24)
  months?: number;
}
