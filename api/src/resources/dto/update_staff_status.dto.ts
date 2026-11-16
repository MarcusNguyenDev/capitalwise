import { IsIn } from 'class-validator';

import { STAFF_STATUSES } from '../../routing/constants/routing_rules.constant';

export class UpdateStaffStatusDto {
  @IsIn(STAFF_STATUSES)
  status: string;
}
