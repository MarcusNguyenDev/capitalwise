import { Injectable, Logger } from '@nestjs/common';

import { AuditEventsRepository } from '../audit/audit_events.repository';
import { CallsService } from '../calls/calls.service';
import { CallRow } from '../calls/types/call_row.type';
import { CallTurn } from '../calls/types/call_turn.type';
import { EngineApiRejectedError } from '../engine_api/errors/engine_api_rejected.error';
import { EngineApiUnavailableError } from '../engine_api/errors/engine_api_unavailable.error';
import { findToolDefinition } from './constants/tool_definitions.constant';
import { ToolRejectedError } from './errors/tool_rejected.error';
import { ActionToolsHandler } from './handlers/action_tools.handler';
import { BankingLookupToolsHandler } from './handlers/banking_lookup_tools.handler';
import { CallInsightToolsHandler } from './handlers/call_insight_tools.handler';
import { CallerIdentityToolsHandler } from './handlers/caller_identity_tools.handler';
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

function buildFailure(code: string, message: string): ToolFailure {
  return { ok: false, error: { code, message } };
}

@Injectable()
export class CallToolsService {
  private readonly logger = new Logger(CallToolsService.name);
  private readonly tool_handlers: Record<ToolName, ToolHandler>;

  constructor(
    private readonly calls_service: CallsService,
    private readonly audit_events_repository: AuditEventsRepository,
    caller_identity_tools: CallerIdentityToolsHandler,
    banking_lookup_tools: BankingLookupToolsHandler,
    action_tools: ActionToolsHandler,
    call_insight_tools: CallInsightToolsHandler,
  ) {
    this.tool_handlers = {
      get_caller_context: (context) =>
        caller_identity_tools.getCallerContext(context),
      send_identity_push: (context) =>
        caller_identity_tools.sendIdentityPush(context),
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
    const tool_outcome = await this.runTool(call, tool_name, raw_args);
    await this.recordToolCall({
      call,
      tool_name,
      raw_args,
      tool_outcome,
      latency_ms: Date.now() - started_at_ms,
    });
    return tool_outcome;
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
    if (tool_definition.requires_matched_customer && !call.customer_id) {
      return buildFailure(
        'CALLER_NOT_MATCHED',
        'This phone number is not linked to a customer, so account tools are not available. Offer to connect the caller with a person using request_human.',
      );
    }
    if (tool_definition.requires_verified_identity && !call.identity_verified) {
      return buildFailure(
        'IDENTITY_NOT_VERIFIED',
        'The caller is not verified yet. Call send_identity_push first.',
      );
    }
    return null;
  }

  private mapHandlerError(tool_name: string, error: unknown): ToolFailure {
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
