import { Injectable } from '@nestjs/common';

import { CallsService } from '../../calls/calls.service';
import { CallRiskLevel, CallRow } from '../../calls/types/call_row.type';
import { EngineApiClient } from '../../engine_api/engine_api.client';
import { ProposalResult } from '../../engine_api/types/proposal_result.type';
import { findProposableAction } from '../constants/proposable_action_codes.constant';
import { FlagConcernArgsDto } from '../dto/flag_concern_args.dto';
import { LockCardArgsDto } from '../dto/lock_card_args.dto';
import { ProposeActionArgsDto } from '../dto/propose_action_args.dto';
import { RequestHumanArgsDto } from '../dto/request_human_args.dto';
import { ToolRejectedError } from '../errors/tool_rejected.error';
import { ToolContext } from '../types/tool_context.type';
import { validateToolArgs } from '../validate_tool_args.util';

const ESCALATION_TIER = 3;
const FALLBACK_SPECIALIST_NAME = 'a specialist';

const CONCERN_ATTENTION_REASONS: Record<FlagConcernArgsDto['type'], string> = {
  SCAM_COACHING: 'Possible scam coaching',
  VULNERABILITY: 'Vulnerability signals',
};

interface AttentionRequest {
  attention_reason: string;
  staff_id: string | null;
  risk_level?: CallRiskLevel;
}

@Injectable()
export class ActionToolsHandler {
  constructor(
    private readonly engine_api_client: EngineApiClient,
    private readonly calls_service: CallsService,
  ) {}

  async lockCard(
    tool_context: ToolContext,
    tool_args: LockCardArgsDto,
  ): Promise<Record<string, unknown>> {
    const proposal_result = await this.engine_api_client.proposeAction({
      call_id: tool_context.call.call_id,
      action_code: 'LOCK_CARD',
      params: { card_id: tool_args.card_id },
      summary: 'Caller asked for a temporary lock on their card.',
    });
    await this.raiseAttentionIfEscalated(tool_context.call, proposal_result);
    const execution_result = proposal_result.execution_result ?? {};
    return {
      locked:
        proposal_result.is_executed &&
        execution_result.card_status === 'TEMP_LOCKED',
      case_number: proposal_result.case_number,
      card_last4: execution_result.card_last4 ?? null,
      last_transaction: execution_result.last_transaction ?? null,
      message: proposal_result.customer_message,
    };
  }

  async proposeAction(
    tool_context: ToolContext,
    tool_args: ProposeActionArgsDto,
  ): Promise<Record<string, unknown>> {
    const action_params = await this.validateActionParams(
      tool_args.action_code,
      tool_args.params,
    );
    const proposal_result = await this.engine_api_client.proposeAction({
      call_id: tool_context.call.call_id,
      action_code: tool_args.action_code,
      params: action_params,
      summary: tool_args.summary,
      customer_statement: tool_args.customer_statement,
      soft_signals: tool_args.soft_signals
        ? { ...tool_args.soft_signals }
        : undefined,
    });
    await this.raiseAttentionIfEscalated(tool_context.call, proposal_result);
    return { ...proposal_result };
  }

  // Each action has its own params; unknown ones are dropped, wrong ones are
  // answered with INVALID_ARGUMENTS before the api is called.
  private async validateActionParams(
    action_code: string,
    raw_params: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const proposable_action = findProposableAction(action_code);
    if (!proposable_action) {
      throw new ToolRejectedError(
        'INVALID_ARGUMENTS',
        `${action_code} is not an action you can propose.`,
      );
    }
    const params_validation = await validateToolArgs(
      proposable_action.params_dto,
      raw_params,
    );
    if (!params_validation.is_valid) {
      throw new ToolRejectedError(
        'INVALID_ARGUMENTS',
        `The params for ${action_code} are not valid: ${params_validation.validation_messages.join('; ')}. Expected ${proposable_action.params_signature}.`,
      );
    }
    const action_params = { ...params_validation.tool_args } as Record<
      string,
      unknown
    >;
    const required_any_of = proposable_action.required_any_of ?? [];
    const has_required_param =
      required_any_of.length === 0 ||
      required_any_of.some(
        (param_name) => action_params[param_name] !== undefined,
      );
    if (!has_required_param) {
      throw new ToolRejectedError(
        'INVALID_ARGUMENTS',
        `The params for ${action_code} need at least one of ${required_any_of.join(', ')}.`,
      );
    }
    return action_params;
  }

  async requestHuman(
    tool_context: ToolContext,
    tool_args: RequestHumanArgsDto,
  ): Promise<Record<string, unknown>> {
    const proposal_result = await this.engine_api_client.proposeAction({
      call_id: tool_context.call.call_id,
      action_code: 'HUMAN_CALLBACK',
      params: { reason: tool_args.reason },
      summary: `Caller asked to speak with a person: ${tool_args.reason}`,
    });
    await this.raiseAttention(tool_context.call, {
      attention_reason: `Asked for a person: ${tool_args.reason}`,
      staff_id: proposal_result.handled_by?.staff_id ?? null,
    });
    return this.buildSpecialistResult(proposal_result);
  }

  async flagConcern(
    tool_context: ToolContext,
    tool_args: FlagConcernArgsDto,
  ): Promise<Record<string, unknown>> {
    const concern_result = await this.engine_api_client.flagConcern({
      call_id: tool_context.call.call_id,
      type: tool_args.type,
      quotes: tool_args.quotes,
      signals: tool_args.signals,
    });
    await this.raiseAttention(tool_context.call, {
      attention_reason: CONCERN_ATTENTION_REASONS[tool_args.type],
      staff_id: concern_result.handled_by?.staff_id ?? null,
      risk_level: 'HIGH',
    });
    return this.buildSpecialistResult(concern_result);
  }

  private buildSpecialistResult(
    proposal_result: ProposalResult,
  ): Record<string, unknown> {
    return {
      case_number: proposal_result.case_number,
      specialist_name:
        proposal_result.handled_by?.name ?? FALLBACK_SPECIALIST_NAME,
      expected_wait_minutes: proposal_result.expected_wait_minutes,
      message: proposal_result.customer_message,
    };
  }

  private async raiseAttentionIfEscalated(
    call: CallRow,
    proposal_result: ProposalResult,
  ): Promise<void> {
    if (proposal_result.tier !== ESCALATION_TIER) {
      return;
    }
    await this.raiseAttention(call, {
      attention_reason: proposal_result.reason,
      staff_id: proposal_result.handled_by?.staff_id ?? null,
    });
  }

  // A call a human already took over is never downgraded to NEEDS_ATTENTION.
  private async raiseAttention(
    call: CallRow,
    attention_request: AttentionRequest,
  ): Promise<void> {
    await this.calls_service.changeCall(
      call.call_id,
      this.calls_service.buildAgentActor(call),
      (locked_call) => {
        const risk_change = attention_request.risk_level
          ? { risk_level: attention_request.risk_level }
          : {};
        if (locked_call.status === 'HUMAN_ACTIVE') {
          return risk_change;
        }
        return {
          ...risk_change,
          status: 'NEEDS_ATTENTION',
          attention_reason: attention_request.attention_reason,
          assigned_staff_id:
            attention_request.staff_id ?? locked_call.assigned_staff_id,
          metrics: {
            ...locked_call.metrics,
            human_requested_at:
              locked_call.metrics.human_requested_at ??
              new Date().toISOString(),
          },
        };
      },
    );
  }
}
