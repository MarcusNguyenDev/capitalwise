import { BadRequestException } from '@nestjs/common';

import { ACTION_CODES } from '../../facts/constants/action_code.constant';

export class UnknownActionCodeError extends BadRequestException {
  readonly error_code = 'UNKNOWN_ACTION_CODE';

  constructor(action_code: string) {
    super(
      `Unknown action code ${action_code}. Use one of ${Object.values(ACTION_CODES).join(', ')}.`,
    );
  }
}
