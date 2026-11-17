import { Injectable, Logger } from '@nestjs/common';

import { AuditEventsRepository } from '../audit/audit_events.repository';
import { CallHoldService } from '../calls/call_hold.service';
import { CallsService } from '../calls/calls.service';
import { readIdentityLevel } from '../calls/read_identity_level.util';
import { CallRow } from '../calls/types/call_row.type';
import { CallTurn } from '../calls/types/call_turn.type';
import { EngineApiRejectedError } from '../engine_api/errors/engine_api_rejected.error';
import { EngineApiUnavailableError } from '../engine_api/errors/engine_api_unavailable.error';
import { findHoldReason } from '../hold_buffer/constants/tool_hold_classes.constant';
import { findToolDefinition } from './constants/tool_definitions.constant';
import { ToolRejectedError } from './errors/tool_rejected.error';
import { ActionToolsHandler } from './handlers/action_tools.handler';
import { BankingLookupToolsHandler } from './handlers/banking_lookup_tools.handler';
import { CallInsightToolsHandler } from './handlers/call_insight_tools.handler';
import { CallerIdentityToolsHandler } from './handlers/caller_identity_tools.handler';
import { IdentityCheckToolsHandler } from './handlers/identity_check_tools.handler';
import { ToolHandler } from './types/tool_context.type';
import { ToolDefinition, ToolName } from './types/tool_definition.type';
import { ToolFailure, ToolOutcome } from './types/tool_outcome.type';
import { validateToolArgs } from './validate_tool_args.util';

interface ToolCallRecord {
  call: CallRow;
  tool_name: string;
  raw_args: Record<string, unknown>;
  tool_outcome: ToolOutcome;
  latency_ms: number;
}

const IDENTITY_LEVEL_REQUIRED = 'IDENTITY_LEVEL_REQUIRED';

// The api's other identity gates, answered with what the model should do.
const IDENTITY_GATE_MESSAGES: Record<string, string> = {
  IDENTITY_LOCKED:
    'Identity checks are locked on this call after failed attempts. Do not discuss any account. Say kindly that, for their security, a specialist will help, and stop.',
  VERIFIED_CALLER_MISMATCH:
    'The caller confirmed on this call is not the customer of that account. Do not discuss it. Confirm identity again with start_identity_check if the caller is someone else.',
  CUSTOMER_NOT_VERIFIED_CALLER:
    'That account belongs to someone other than the confirmed caller. Do not discuss it or act on it.',
};

function buildFailure(code: string, message: string): ToolFailure {
  return { ok: false, error: { code, message } };
}

// Written for the model: what to do next. Level 2 always follows level 1.
function buildIdentityLevelMessage(
  required_level: number,
  current_level: number,
): string {
  const next_step =
    required_level === 2 && current_level === 0
      ? 'call start_identity_check with level 1, then with level 2'
      : `call start_identity_check with level ${required_level}`;
  return `Confirm identity to level ${required_level} first: ${next_step}.`;
}

function readLevel(raw_level: unknown, fallback_level: number): number {
  const level = Number(raw_level);
  return Number.isInteger(level) && level >= 0 ? level : fallback_level;
}

@Injectable()
export class CallToolsService {
  private readonly logger = new Logger(CallToolsService.name);
  private readonly tool_handlers: Record<ToolName, ToolHandler>;

  constructor(
    private readonly calls_service: CallsService,
    private readonly audit_events_repository: AuditEventsRepository,
    private readonly call_hold_service: CallHoldService,
    caller_identity_tools: CallerIdentityToolsHandler,
    identity_check_tools: IdentityCheckToolsHandler,
    banking_lookup_tools: BankingLookupToolsHandler,
    action_tools: ActionToolsHandler,
    call_insight_tools: CallInsightToolsHandler,
  ) {
    this.tool_handlers = {
      get_caller_context: (context) =>
        caller_identity_tools.getCallerContext(context),
      start_identity_check: (context, args) =>
        identity_check_tools.startIdentityCheck(context, args),
      submit_identity_answers: (context, args) =>
        identity_check_tools.submitIdentityAnswers(context, args),
      send_app_identity_check: (context) =>
        caller_identity_tools.sendAppIdentityCheck(context),
      get_customer_overview: (context) =>
        banking_lookup_tools.getCustomerOverview(context),
      get_recent_transactions: (context, args) =>
        banking_lookup_tools.getRecentTransactions(context, args),
      get_fee_history: (context, args) =>
        banking_lookup_tools.getFeeHistory(context, args),
      get_income_summary: (context) =>
        banking_lookup_tools.getIncomeSummary(context),
      get_loan_details: (context, args) =>
        banking_lookup_tools.getLoanDetails(context, args),
      get_held_payments: (context) =>
        banking_lookup_tools.getHeldPayments(context),
      lock_card: (context, args) => action_tools.lockCard(context, args),
      propose_action: (context, args) =>
        action_tools.proposeAction(context, args),
      request_human: (context, args) =>
        action_tools.requestHuman(context, args),
      flag_concern: (context, args) => action_tools.flagConcern(context, args),
      update_call_insight: (context, args) =>
        call_insight_tools.updateCallInsight(context, args),
    };
  }

  // Never throws for a tool problem: the model always gets `ok: true|false`.
  // It only throws CallNotFoundError / CallEndedError for the call itself.
  async dispatchTool(
    call_id: string,
    tool_name: string,
    raw_args: Record<string, unknown> = {},
  ): Promise<ToolOutcome> {
    const call = await this.calls_service.getActiveCall(call_id);
    const started_at_ms = Date.now();
    const tool_outcome = await this.runToolOnHold(call, tool_name, raw_args);
    await this.recordToolCall({
      call,
      tool_name,
      raw_args,
      tool_outcome,
      latency_ms: Date.now() - started_at_ms,
    });
    return tool_outcome;
  }

  // Scripted and simulated calls show the same hold state as live ones. In
  // LIVE mode the voice agent owns the hold (it also plays the hold lines),
  // so the dispatcher never emits it twice.
  private async runToolOnHold(
    call: CallRow,
    tool_name: string,
    raw_args: Record<string, unknown>,
  ): Promise<ToolOutcome> {
    const hold_reason =
      call.metrics.mode === 'LIVE' ? null : findHoldReason([tool_name]);
    if (!hold_reason) {
      return this.runTool(call, tool_name, raw_args);
    }
    await this.call_hold_service.startHold(call.call_id, {
      reason: hold_reason,
      tool_name,
    });
    try {
      return await this.runTool(call, tool_name, raw_args);
    } finally {
      await this.call_hold_service.endHold(call.call_id);
    }
  }

  private async runTool(
    call: CallRow,
    tool_name: string,
    raw_args: Record<string, unknown>,
  ): Promise<ToolOutcome> {
    const tool_definition = findToolDefinition(tool_name);
    if (!tool_definition) {
      return buildFailure(
        'UNKNOWN_TOOL',
        `There is no tool called ${tool_name}. Use only the tools you were given.`,
      );
    }
    const precondition_failure = this.checkPreconditions(call, tool_definition);
    if (precondition_failure) {
      return precondition_failure;
    }
    const args_validation = await validateToolArgs(
      tool_definition.args_dto,
      raw_args,
    );
    if (!args_validation.is_valid) {
      return buildFailure(
        'INVALID_ARGUMENTS',
        `The arguments for ${tool_name} are not valid: ${args_validation.validation_messages.join('; ')}.`,
      );
    }
    try {
      const result = await this.tool_handlers[tool_definition.name](
        { call },
        args_validation.tool_args,
      );
      return { ok: true, result };
    } catch (error) {
      return this.mapHandlerError(tool_name, error);
    }
  }

  private checkPreconditions(
    call: CallRow,
    tool_definition: ToolDefinition,
  ): ToolFailure | null {
    if (readIdentityLevel(call) < tool_definition.required_identity_level) {
      return buildFailure(
        IDENTITY_LEVEL_REQUIRED,
        buildIdentityLevelMessage(
          tool_definition.required_identity_level,
          readIdentityLevel(call),
        ),
      );
    }
    if (tool_definition.requires_matched_customer && !call.customer_id) {
      return buildFailure(
        'CALLER_NOT_MATCHED',
        'This phone number is not on file, so the app check is not available. Confirm identity with start_identity_check instead.',
      );
    }
    return null;
  }

  private mapHandlerError(tool_name: string, error: unknown): ToolFailure {
    if (
      error instanceof EngineApiRejectedError &&
      error.api_error_code === IDENTITY_LEVEL_REQUIRED
    ) {
      return buildFailure(
        IDENTITY_LEVEL_REQUIRED,
        buildIdentityLevelMessage(
          readLevel(error.api_details.required_level, 1),
          readLevel(error.api_details.current_level, 0),
        ),
      );
    }
    if (
      error instanceof EngineApiRejectedError &&
      error.api_error_code in IDENTITY_GATE_MESSAGES
    ) {
      return buildFailure(
        error.api_error_code,
        IDENTITY_GATE_MESSAGES[error.api_error_code],
      );
    }
    if (error instanceof EngineApiRejectedError) {
      return buildFailure(error.api_error_code, error.api_message);
    }
    if (error instanceof ToolRejectedError) {
      return buildFailure(error.error_code, error.message);
    }
    if (error instanceof EngineApiUnavailableError) {
      this.logger.error(`Tool ${tool_name} could not reach the api service`);
      return buildFailure(
        error.error_code,
        'The bank system did not respond. Apologise, try once more, and if it fails again offer a person with request_human.',
      );
    }
    this.logger.error(
      `Tool ${tool_name} failed unexpectedly: ${(error as Error)?.message}`,
      (error as Error)?.stack,
    );
    return buildFailure(
      'TOOL_FAILED',
      'That did not work because of a system problem. Apologise and offer a person with request_human.',
    );
  }

  // Every tool call, successful or not, lands in call_turns and audit_events.
  private async recordToolCall(
    tool_call_record: ToolCallRecord,
  ): Promise<void> {
    const { call, tool_name, raw_args, tool_outcome, latency_ms } =
      tool_call_record;
    const call_turn = await this.calls_service.withLockedCall(
      call.call_id,
      this.calls_service.buildAgentActor(call),
      async (_locked_call, transaction): Promise<CallTurn> => {
        const inserted_turn = await this.calls_service.insertTurnInTransaction(
          transaction,
          {
            call_id: call.call_id,
            speaker: 'SYSTEM',
            tool_name,
            tool_args: raw_args,
            tool_result: tool_outcome.ok
              ? tool_outcome.result
              : { error: tool_outcome.error },
            latency_ms,
          },
        );
        await this.audit_events_repository.insertEvent(transaction, {
          event_type: 'TOOL_CALL',
          call_id: call.call_id,
          case_number: this.readCaseNumber(tool_outcome),
          detail: {
            tool_name,
            args: raw_args,
            ok: tool_outcome.ok,
            ...(tool_outcome.ok ? {} : { error_code: tool_outcome.error.code }),
            latency_ms,
          },
        });
        return inserted_turn;
      },
    );
    this.calls_service.broadcastTurn(call_turn);
  }

  private readCaseNumber(tool_outcome: ToolOutcome): string | null {
    if (!tool_outcome.ok) {
      return null;
    }
    const case_number = tool_outcome.result.case_number;
    return typeof case_number === 'string' ? case_number : null;
  }
}
