import { Matches } from 'class-validator';

import { CARD_ID_PATTERN } from '../../constants/id_patterns.constant';

// LOCK_CARD, UNLOCK_CARD, REPLACE_CARD and ACTIVATE_CARD.
export class CardActionParamsDto {
  @Matches(CARD_ID_PATTERN, { message: 'card_id must look like CRD-10011' })
  card_id: string;
}
