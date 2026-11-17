import { Transform } from 'class-transformer';
import {
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

import { TRANSACTION_ID_PATTERN } from '../../constants/id_patterns.constant';
import { normaliseCode } from './normalise_code.transform';

export const DISPUTE_REASONS = [
  'DUPLICATE',
  'UNRECOGNISED',
  'NOT_RECEIVED',
  'WRONG_AMOUNT',
] as const;

export class RaiseDisputeParamsDto {
  @Matches(TRANSACTION_ID_PATTERN, {
    message: 'txn_id must be a transaction id from get_recent_transactions',
  })
  txn_id: string;

  @Transform(normaliseCode)
  @IsIn(DISPUTE_REASONS)
  reason: (typeof DISPUTE_REASONS)[number];

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  details?: string;
}
