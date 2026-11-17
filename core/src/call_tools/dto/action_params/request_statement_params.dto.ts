import { Transform, Type } from 'class-transformer';
import { IsIn, IsInt, Matches, Max, Min } from 'class-validator';

import { ACCOUNT_ID_PATTERN } from '../../constants/id_patterns.constant';
import { normaliseCode } from './normalise_code.transform';

export class RequestStatementParamsDto {
  @Matches(ACCOUNT_ID_PATTERN, {
    message: 'account_id must look like ACC-10011',
  })
  account_id: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  months: number;

  @Transform(normaliseCode)
  @IsIn(['POST', 'EMAIL'])
  delivery: 'POST' | 'EMAIL';
}
