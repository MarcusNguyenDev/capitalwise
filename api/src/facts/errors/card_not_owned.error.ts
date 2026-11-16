import { ForbiddenException } from '@nestjs/common';

export class CardNotOwnedError extends ForbiddenException {
  readonly error_code = 'CARD_NOT_OWNED';

  constructor(card_id: string) {
    super(`Card ${card_id} does not belong to the caller.`);
  }
}
