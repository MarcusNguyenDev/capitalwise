import { Matches } from 'class-validator';

import { TRANSACTION_ID_PATTERN } from '../../constants/id_patterns.constant';

export class RefundFeeParamsDto {
  @Matches(TRANSACTION_ID_PATTERN, {
    message: 'fee_txn_id must be a fee id from get_fee_history, e.g. TXN-F1002',
  })
  fee_txn_id: string;
}
