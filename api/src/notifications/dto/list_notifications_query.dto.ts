import { IsInt, IsString, IsUUID, Min } from 'class-validator';

import {
  OptionalQueryNumber,
  OptionalQueryText,
} from '../../shared_kernel/decorators/optional_query.decorator';

export class ListNotificationsQueryDto {
  @OptionalQueryText()
  @IsString()
  customer_id?: string;

  @OptionalQueryText()
  @IsUUID()
  call_id?: string;

  @OptionalQueryNumber()
  @IsInt()
  @Min(1)
  limit?: number;
}
