import { NotFoundException } from '@nestjs/common';

export class InterventionNotFoundError extends NotFoundException {
  readonly error_code = 'INTERVENTION_NOT_FOUND';

  constructor(intervention_id: string, call_id: string) {
    super(`Intervention ${intervention_id} was not found on call ${call_id}.`);
  }
}
