import { Injectable } from '@nestjs/common';

import { CallRecordsService } from '../call_records/call_records.service';
import { CallRecord } from '../call_records/types/call_record.type';
import { CoreBankingAdapter } from '../core_banking/core_banking.adapter';
import { HeldPayment } from '../core_banking/types/bank_records.type';
import {
  ACTION_CODES,
  UNKNOWN_CUSTOMER_ID,
} from '../facts/constants/action_code.constant';
import { SoftSignals } from '../facts/types/soft_signals.type';
import { normaliseSoftSignals } from '../facts/utils/merge_soft_signals.util';
import { IdentityRecordsService } from '../identity_records/identity_records.service';
import { ESCALATION_TIER } from '../policies/constants/route_tier.constant';
import { PoliciesService } from '../policies/policies.service';
import { formatCurrency } from '../shared_kernel/utils/format_currency.util';
import { CaseIntakeService } from './case_intake.service';
import { CasesRepository } from './cases.repository';
import { UNDECIDED_STATUSES } from './constants/case_status.constant';
import { FlagConcernDto } from './dto/flag_concern.dto';
import { ProposalResultFactory } from './proposal_result.factory';
import { Caller, CaseIntake } from './types/case_intake.type';
import { ConcernResult, ProposalResult } from './types/proposal_result.type';

const DEFAULT_SCAM_SIGNALS = ['TOLD_TO_MOVE_MONEY'];
const DEFAULT_VULNERABILITY_SIGNALS = ['CONFUSION'];
const FRAUD_SKILL = 'FRAUD';
const CARE_SKILL = 'CARE';

interface ConcernContext {
  call: CallRecord;
  caller: Caller;
  identity_level: number;
  soft_signals: SoftSignals;
}

// Scam coaching and vulnerability are always Tier 3: the AI never decides
// them, it gets a specialist with the right skill onto the call.
@Injectable()
export class ConcernsService {
  constructor(
    private readonly call_records_service: CallRecordsService,
    private readonly core_banking_adapter: CoreBankingAdapter,
    private readonly policies_service: PoliciesService,
    private readonly identity_records_service: IdentityRecordsService,
    private readonly case_intake_service: CaseIntakeService,
    private readonly cases_repository: CasesRepository,
    private readonly proposal_result_factory: ProposalResultFactory,
  ) {}

  async flagConcern(concern: FlagConcernDto): Promise<ConcernResult> {
    const call = await this.call_records_service.getCall(concern.call_id);
    const is_scam_concern = concern.type === 'SCAM_COACHING';
    const signals = concern.signals?.length
      ? concern.signals
      : is_scam_concern
        ? DEFAULT_SCAM_SIGNALS
        : DEFAULT_VULNERABILITY_SIGNALS;
    const identity_summary = await this.identity_records_service.summariseCall(
      call.call_id,
    );
    const concern_context: ConcernContext = {
      call,
      caller: this.case_intake_service.resolveCaller(call),
      identity_level: identity_summary.identity_level,
      soft_signals: normaliseSoftSignals({
        scam_coaching_signals: is_scam_concern ? signals : [],
        vulnerability_signals: is_scam_concern ? [] : signals,
        quotes: concern.quotes ?? [],
      }),
    };
    const proposal_result = is_scam_concern
      ? await this.raiseScamConcern(concern_context)
      : await this.raiseVulnerabilityConcern(concern_context);
    return {
      ...proposal_result,
      risk_level: 'HIGH',
      concern_type: concern.type,
    };
  }

  private async raiseScamConcern(
    concern_context: ConcernContext,
  ): Promise<ProposalResult> {
    const held_payment = await this.findHeldPayment(concern_context.caller);
    const case_intake = held_payment
      ? await this.buildHeldPaymentIntake(concern_context, held_payment)
      : await this.buildHandoverIntake(concern_context, {
          reason: 'Possible scam coaching heard on the call.',
          required_skill: FRAUD_SKILL,
        });
    return this.case_intake_service.openOrUpgradeCase(case_intake);
  }

  private async raiseVulnerabilityConcern(
    concern_context: ConcernContext,
  ): Promise<ProposalResult> {
    const call_id = concern_context.call.call_id;
    const undecided_cases = await this.cases_repository.selectCallCases(
      call_id,
      UNDECIDED_STATUSES,
    );
    for (const undecided_case of undecided_cases) {
      await this.case_intake_service.reevaluateCase(undecided_case, {
        call: concern_context.call,
        added_soft_signals: concern_context.soft_signals,
        escalation_skill: CARE_SKILL,
      });
    }
    const reevaluated_cases = await this.cases_repository.selectCallCases(
      call_id,
      UNDECIDED_STATUSES,
    );
    const escalated_case = reevaluated_cases.find(
      (reevaluated_case) => reevaluated_case.tier === ESCALATION_TIER,
    );
    if (escalated_case) {
      return this.proposal_result_factory.buildProposalResult(
        escalated_case.case_number,
      );
    }
    return this.case_intake_service.openOrReuseCase(
      await this.buildHandoverIntake(concern_context, {
        reason: 'Vulnerability signals heard on the call.',
        required_skill: CARE_SKILL,
      }),
    );
  }

  private async findHeldPayment(caller: Caller): Promise<HeldPayment | null> {
    if (caller.customer_id === UNKNOWN_CUSTOMER_ID) {
      return null;
    }
    const held_payments = await this.core_banking_adapter.listHeldPayments(
      caller.customer_id,
    );
    return held_payments[0] ?? null;
  }

  private async buildHeldPaymentIntake(
    concern_context: ConcernContext,
    held_payment: HeldPayment,
  ): Promise<CaseIntake> {
    const payee_label = held_payment.payee_name
      ? ` to "${held_payment.payee_name}"`
      : '';
    return {
      ...concern_context,
      action_type: await this.policies_service.getActionType(
        ACTION_CODES.RELEASE_HELD_PAYMENT,
      ),
      params: { txn_id: held_payment.txn_id },
      summary: `Possible scam coaching. ${concern_context.caller.customer_name} is asking about a held ${formatCurrency(held_payment.amount)} payment${payee_label}. The payment stays held until a fraud specialist has spoken with them.`,
      customer_statement: concern_context.soft_signals.quotes[0] ?? null,
      required_skill_override: FRAUD_SKILL,
    };
  }

  private async buildHandoverIntake(
    concern_context: ConcernContext,
    handover: { reason: string; required_skill: string },
  ): Promise<CaseIntake> {
    return {
      ...concern_context,
      action_type: await this.policies_service.getActionType(
        ACTION_CODES.HUMAN_CALLBACK,
      ),
      params: handover,
      summary: `${handover.reason} ${concern_context.caller.customer_name} needs a ${handover.required_skill} specialist on the call.`,
      customer_statement: concern_context.soft_signals.quotes[0] ?? null,
      required_skill_override: handover.required_skill,
    };
  }
}
