import { ForbiddenException } from '@nestjs/common';

export class SkillRequiredError extends ForbiddenException {
  readonly error_code = 'SKILL_REQUIRED';

  constructor(required_skill: string, action_code: string) {
    super(
      `Only a specialist with the ${required_skill} skill can approve ${action_code}.`,
    );
  }
}
