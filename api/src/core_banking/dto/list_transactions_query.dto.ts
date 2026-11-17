import { IsInt, IsNotEmpty, IsString, Max, Min } from 'class-validator';

import {
  OptionalQueryNumber,
  OptionalQueryText,
} from '../../shared_kernel/decorators/optional_query.decorator';
import { MAX_TRANSACTION_WINDOW_HOURS } from '../constants/banking_limits.constant';
import { CallerQueryDto } from './caller_query.dto';

export class ListTransactionsQueryDto extends CallerQueryDto {
  @OptionalQueryText()
  @IsString()
  @IsNotEmpty()
  account_id?: string;

  @OptionalQueryNumber()
  @IsInt()
  @Min(1)
  @Max(MAX_TRANSACTION_WINDOW_HOURS)
  hours?: number;
}
