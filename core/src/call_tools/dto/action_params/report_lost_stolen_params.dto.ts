import { Transform } from 'class-transformer';
import { IsIn, Matches } from 'class-validator';

import { CARD_ID_PATTERN } from '../../constants/id_patterns.constant';
import { normaliseCode } from './normalise_code.transform';

export class ReportLostStolenParamsDto {
  @Matches(CARD_ID_PATTERN, { message: 'card_id must look like CRD-10011' })
  card_id: string;

  @Transform(normaliseCode)
  @IsIn(['LOST', 'STOLEN'])
  reason: 'LOST' | 'STOLEN';
}
