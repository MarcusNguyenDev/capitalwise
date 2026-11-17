import { IsUUID } from 'class-validator';

import { OptionalQueryText } from '../../shared_kernel/decorators/optional_query.decorator';

// When a request is made for a call (core, on behalf of the AI), the caller
// must be verified to level 1 as this very customer. Without call_id it is a
// staff read from the supervisor console.
export class CallerQueryDto {
  @OptionalQueryText()
  @IsUUID()
  call_id?: string;
}
