import { Transform } from 'class-transformer';
import { IsIn, IsInt, Min } from 'class-validator';

import {
  OptionalQueryNumber,
  OptionalQueryText,
} from '../../shared_kernel/decorators/optional_query.decorator';

export const CALL_LIST_STATUSES = ['ended', 'live', 'all'] as const;

export class ListCallsQueryDto {
  @OptionalQueryText()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.toLowerCase() : value,
  )
  @IsIn(CALL_LIST_STATUSES)
  status?: (typeof CALL_LIST_STATUSES)[number];

  @OptionalQueryNumber()
  @IsInt()
  @Min(1)
  limit?: number;
}
