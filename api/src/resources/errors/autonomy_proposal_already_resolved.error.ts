import { ConflictException } from '@nestjs/common';

export class AutonomyProposalAlreadyResolvedError extends ConflictException {
  readonly error_code = 'AUTONOMY_PROPOSAL_ALREADY_RESOLVED';

  constructor(proposal_id: number, status: string) {
    super(`Autonomy proposal ${proposal_id} is already ${status}.`);
  }
}
