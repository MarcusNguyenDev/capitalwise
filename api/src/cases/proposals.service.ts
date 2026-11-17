import { Injectable } from '@nestjs/common';

import { CallRecordsService } from '../call_records/call_records.service';
import { normaliseSoftSignals } from '../facts/utils/merge_soft_signals.util';
import { IdentityRecordsService } from '../identity_records/identity_records.service';
import { PoliciesService } from '../policies/policies.service';
import { ACTION_CODES } from '../facts/constants/action_code.constant';
import { SKILLS } from '../routing/constants/routing_rules.constant';
import { CaseIntakeService } from './case_intake.service';
import { ProposeActionDto } from './dto/propose_action.dto';
import { ProposalResult } from './types/proposal_result.type';

@Injectable()
export class ProposalsService {
  constructor(
    private readonly call_records_service: CallRecordsService,
    private readonly policies_service: PoliciesService,
    private readonly identity_records_service: IdentityRecordsService,
    private readonly case_intake_service: CaseIntakeService,
  ) {}

  // The caller is whoever the verified record says, at the level the action
  // needs (engine.action_types.required_identity_level). Asking for a person
  // needs no verification: resolve, don't deflect.
  async proposeAction(proposal: ProposeActionDto): Promise<ProposalResult> {
    const call = await this.call_records_service.getCall(proposal.call_id);
    const action_type = await this.policies_service.getActionType(
      proposal.action_code,
    );
    const identity_summary =
      await this.identity_records_service.assertVerifiedCaller(
        call,
        action_type.required_identity_level,
      );
    const params = proposal.params ?? {};
    return this.case_intake_service.openOrReuseCase({
      call,
      caller: this.case_intake_service.resolveCaller(call),
      identity_level: identity_summary.identity_level,
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
