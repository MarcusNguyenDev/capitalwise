import { ConflictException } from '@nestjs/common';

export class CallNotWithHumanError extends ConflictException {
  readonly error_code = 'CALL_NOT_WITH_HUMAN';

  constructor(call_id: string) {
    super(
      `Call ${call_id} is not being handled by a staff member. Take over first.`,
    );
  }
}
