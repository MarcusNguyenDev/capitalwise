import { ConflictException } from '@nestjs/common';

export class LevelOneRequiredError extends ConflictException {
  readonly error_code = 'LEVEL_ONE_REQUIRED';

  constructor() {
    super(
      'Confirm level 1 first: call start_identity_check with level 1 (full name, date of birth and postcode).',
    );
  }
}
