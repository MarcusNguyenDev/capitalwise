import { ForbiddenException } from '@nestjs/common';

export class DemoModeDisabledError extends ForbiddenException {
  readonly error_code = 'DEMO_MODE_DISABLED';

  constructor() {
    super('Reset is only available when DEMO_MODE=true.');
  }
}
