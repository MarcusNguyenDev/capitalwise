import { NotFoundException } from '@nestjs/common';

export class CardNotFoundError extends NotFoundException {
  readonly error_code = 'CARD_NOT_FOUND';

  constructor(card_id: string) {
    super(`Card ${card_id} was not found.`);
  }
}
