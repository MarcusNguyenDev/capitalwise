import { BadRequestException } from '@nestjs/common';

import { InterventionType } from '../types/intervention.type';

export class InterventionTextRequiredError extends BadRequestException {
  readonly error_code = 'INTERVENTION_TEXT_REQUIRED';

  constructor(intervention_type: InterventionType) {
    super(`text is required for a ${intervention_type} intervention.`);
  }
}
