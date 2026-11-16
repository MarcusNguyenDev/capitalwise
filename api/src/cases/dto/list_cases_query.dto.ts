import { IsInt, IsString, IsUUID, Min } from 'class-validator';

import {
  OptionalQueryNumber,
  OptionalQueryText,
} from '../../shared_kernel/decorators/optional_query.decorator';

export class ListCasesQueryDto {
  // One status or a comma-separated list.
  @OptionalQueryText()
  @IsString()
  status?: string;

  @OptionalQueryText()
  @IsUUID()
  call_id?: string;

  @OptionalQueryText()
  @IsString()
  customer_id?: string;

  @OptionalQueryText()
  @IsString()
  action_code?: string;

  @OptionalQueryNumber()
  @IsInt()
  @Min(1)
  limit?: number;
}
