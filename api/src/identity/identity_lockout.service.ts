import { Injectable } from '@nestjs/common';

import { CallRecord } from '../call_records/types/call_record.type';
import { CaseIntakeService } from '../cases/case_intake.service';
import { ACTION_CODES } from '../facts/constants/action_code.constant';
import { normaliseSoftSignals } from '../facts/utils/merge_soft_signals.util';
import {
  IDENTITY_CHECK_FAILED_SIGNAL,
  IDENTITY_LEVELS,
} from '../identity_records/constants/identity_level.constant';
import { PoliciesService } from '../policies/policies.service';

const FRAUD_SKILL = 'FRAUD';
const LOCKOUT_REASON =
  'Identity checks failed twice on this call. A fraud specialist should contact the customer on the details on file.';

// Two failed identity checks: a Tier 3 HUMAN_CALLBACK case for the FRAUD skill,
// raised through the same policy engine, router and audit trail as any case.
@Injectable()
export class IdentityLockoutService {
  constructor(
    private readonly case_intake_service: CaseIntakeService,
    private readonly policies_service: PoliciesService,
  ) {}

  async raiseFraudCase(call: CallRecord): Promise<string> {
    const params = { reason: LOCKOUT_REASON, required_skill: FRAUD_SKILL };
    const proposal_result = await this.case_intake_service.openOrUpgradeCase({
      call,
      caller: this.case_intake_service.resolveCaller(call),
      identity_level: IDENTITY_LEVELS.NONE,
      action_type: await this.policies_service.getActionType(
        ACTION_CODES.HUMAN_CALLBACK,
      ),
      params,
      summary: LOCKOUT_REASON,
      customer_statement: null,
      soft_signals: normaliseSoftSignals({
        fraud_signals: [IDENTITY_CHECK_FAILED_SIGNAL],
      }),
      required_skill_override: FRAUD_SKILL,
    });
    return proposal_result.case_number;
  }
}
