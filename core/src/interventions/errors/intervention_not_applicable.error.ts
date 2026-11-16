import { ConflictException } from '@nestjs/common';

import { InterventionType } from '../types/intervention.type';

export class InterventionNotApplicableError extends ConflictException {
  readonly error_code = 'INTERVENTION_NOT_APPLICABLE';

  constructor(intervention_id: string, intervention_type: InterventionType) {
    super(
      `Intervention ${intervention_id} is a ${intervention_type}: only an INSTRUCTION or HANDBACK note can be applied.`,
    );
  }
}
