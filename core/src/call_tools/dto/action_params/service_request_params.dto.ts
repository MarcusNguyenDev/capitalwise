import { Transform } from 'class-transformer';
import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';

import { normaliseCode } from './normalise_code.transform';

// The security-sensitive types a specialist completes with the caller. Any
// other type is accepted and goes to staff as a callback.
export const SERVICE_REQUEST_TYPES = [
  'CHANGE_ADDRESS',
  'CHANGE_PHONE',
  'CHANGE_EMAIL',
  'INCREASE_LIMIT',
  'ADD_PAYEE',
  'TRANSFER_MONEY',
  'CLOSE_ACCOUNT',
  'CANCEL_DIRECT_DEBIT',
  'OTHER',
];

export class ServiceRequestParamsDto {
  @Transform(normaliseCode)
  @Matches(/^[A-Z][A-Z0-9_]{1,40}$/, {
    message: `request_type must be one of ${SERVICE_REQUEST_TYPES.join(', ')}`,
  })
  request_type: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  details?: string;
}
