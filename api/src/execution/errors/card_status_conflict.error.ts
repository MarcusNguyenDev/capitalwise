import { ConflictException } from '@nestjs/common';

export class CardStatusConflictError extends ConflictException {
  readonly error_code = 'CARD_STATUS_CONFLICT';

  constructor(card_id: string, card_status: string, action_code: string) {
    super(
      `${action_code} cannot be done on card ${card_id} while it is ${card_status}.`,
    );
  }
}
