import { IsIn, IsInt, IsString, IsUUID, Min } from 'class-validator';

import {
  OptionalQueryNumber,
  OptionalQueryText,
} from '../../shared_kernel/decorators/optional_query.decorator';

export class ListAuditEventsQueryDto {
  @OptionalQueryText()
  @IsIn(['AI', 'STAFF', 'SYSTEM', 'CUSTOMER'])
  actor_type?: string;

  @OptionalQueryText()
  @IsString()
  actor_id?: string;

  @OptionalQueryText()
  @IsString()
  event_type?: string;

  @OptionalQueryText()
  @IsUUID()
  call_id?: string;

  @OptionalQueryText()
  @IsString()
  case_number?: string;

  @OptionalQueryText()
  @IsString()
  search?: string;

  @OptionalQueryNumber()
  @IsInt()
  @Min(1)
  limit?: number;

  @OptionalQueryNumber()
  @IsInt()
  @Min(1)
  before_event_id?: number;
}
