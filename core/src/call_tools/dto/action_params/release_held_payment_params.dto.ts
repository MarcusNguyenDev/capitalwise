import { Matches } from 'class-validator';

import { TRANSACTION_ID_PATTERN } from '../../constants/id_patterns.constant';

export class ReleaseHeldPaymentParamsDto {
  @Matches(TRANSACTION_ID_PATTERN, {
    message: 'txn_id must be a held payment id from get_held_payments',
  })
  txn_id: string;
}
