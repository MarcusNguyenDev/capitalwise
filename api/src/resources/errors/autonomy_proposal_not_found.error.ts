import { NotFoundException } from '@nestjs/common';

export class AutonomyProposalNotFoundError extends NotFoundException {
  readonly error_code = 'AUTONOMY_PROPOSAL_NOT_FOUND';

  constructor(proposal_id: number) {
    super(`Autonomy proposal ${proposal_id} was not found.`);
  }
}
