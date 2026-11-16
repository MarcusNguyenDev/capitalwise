import { Injectable } from '@nestjs/common';

import { CallRecordsService } from '../call_records/call_records.service';
import { CallerNotMatchedError } from '../call_records/errors/caller_not_matched.error';
import { CallRecord } from '../call_records/types/call_record.type';
import { ACTION_CODES } from '../facts/constants/action_code.constant';
import { normaliseSoftSignals } from '../facts/utils/merge_soft_signals.util';
import { PoliciesService } from '../policies/policies.service';
import { SKILLS } from '../routing/constants/routing_rules.constant';
import { CaseIntakeService } from './case_intake.service';
import { ProposeActionDto } from './dto/propose_action.dto';
import { IdentityNotVerifiedError } from './errors/identity_not_verified.error';
import { ProposalResult } from './types/proposal_result.type';

@Injectable()
export class ProposalsService {
  constructor(
    private readonly call_records_service: CallRecordsService,
    private readonly policies_service: PoliciesService,
    private readonly case_intake_service: CaseIntakeService,
  ) {}

  async proposeAction(proposal: ProposeActionDto): Promise<ProposalResult> {
    const call = await this.call_records_service.getCall(proposal.call_id);
    const action_type = await this.policies_service.getActionType(
      proposal.action_code,
    );
    this.assertCallerMayPropose(call, action_type.action_code);
    const params = proposal.params ?? {};
    return this.case_intake_service.openOrReuseCase({
      call,
      caller: this.case_intake_service.resolveCaller(call),
      action_type,
      params,
      summary: proposal.summary?.trim() || action_type.description,
      customer_statement: proposal.customer_statement ?? null,
      soft_signals: normaliseSoftSignals(proposal.soft_signals),
      required_skill_override: this.readRequestedSkill(
        action_type.action_code,
        params,
      ),
    });
  }

  // Asking for a person never needs verification: resolve, don't deflect.
  // Everything else acts on an account, so identity comes first.
  private assertCallerMayPropose(call: CallRecord, action_code: string): void {
    if (action_code === ACTION_CODES.HUMAN_CALLBACK) {
      return;
    }
    if (!call.identity_verified) {
      throw new IdentityNotVerifiedError();
    }
    if (!call.customer_id) {
      throw new CallerNotMatchedError(call.call_id);
    }
  }

  private readRequestedSkill(
    action_code: string,
    params: Record<string, unknown>,
  ): string | null {
    const requested_skill = params.required_skill;
    const is_valid_request =
      action_code === ACTION_CODES.HUMAN_CALLBACK &&
      typeof requested_skill === 'string' &&
      SKILLS.includes(requested_skill);
    return is_valid_request ? (requested_skill as string) : null;
  }
}
