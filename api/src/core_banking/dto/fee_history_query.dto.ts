import { IsNotEmpty, IsString } from 'class-validator';

import { OptionalQueryText } from '../../shared_kernel/decorators/optional_query.decorator';

export class FeeHistoryQueryDto {
  @OptionalQueryText()
  @IsString()
  @IsNotEmpty()
  account_id?: string;
}
