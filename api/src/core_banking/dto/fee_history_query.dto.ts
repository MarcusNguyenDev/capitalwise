import { IsNotEmpty, IsString } from 'class-validator';

import { OptionalQueryText } from '../../shared_kernel/decorators/optional_query.decorator';
import { CallerQueryDto } from './caller_query.dto';

export class FeeHistoryQueryDto extends CallerQueryDto {
  @OptionalQueryText()
  @IsString()
  @IsNotEmpty()
  account_id?: string;
}
