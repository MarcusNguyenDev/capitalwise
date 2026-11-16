import { ForbiddenException } from '@nestjs/common';

export class TeamLeaderRequiredError extends ForbiddenException {
  readonly error_code = 'TEAM_LEADER_REQUIRED';

  constructor(staff_id: string) {
    super(
      `Only a team leader can sign off an autonomy proposal (${staff_id} is not one).`,
    );
  }
}
