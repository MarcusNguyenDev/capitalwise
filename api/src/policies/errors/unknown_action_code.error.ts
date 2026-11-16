import { BadRequestException } from '@nestjs/common';

export class UnknownActionCodeError extends BadRequestException {
  readonly error_code = 'UNKNOWN_ACTION_CODE';

  constructor(action_code: string) {
    super(
      `Unknown action code ${action_code}. Use LOCK_CARD, REFUND_FEE, HARDSHIP_REQUEST, RELEASE_HELD_PAYMENT or HUMAN_CALLBACK.`,
    );
  }
}
