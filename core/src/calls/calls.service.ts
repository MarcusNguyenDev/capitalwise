import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';

import { AuditEventsRepository } from '../audit/audit_events.repository';
import { pricingConfig } from '../config/pricing.config';
import { DatabaseService } from '../database/database.service';
import { TransactionClient } from '../database/types/transaction_client.type';
import { EngineApiClient } from '../engine_api/engine_api.client';
import { InterventionsRepository } from '../interventions/interventions.repository';
import {
  INTERNAL_EVENT,
  LIVE_EVENT,
} from '../live/constants/live_event_names.constant';
import {
  buildCallRoom,
  STAFF_ROOM,
} from '../live/constants/live_rooms.constant';
import { LiveBroadcaster } from '../live/live_broadcaster.service';
import { LiveEventBus } from '../live/live_event_bus.service';
import { Actor, SYSTEM_ACTOR } from '../shared_kernel/types/actor.type';
import { buildCallSummary } from './build_call_summary.util';
import { accumulateUsage } from './call_metrics/accumulate_usage.util';
import { appendResponseTime } from './call_metrics/append_response_time.util';
import { calculateEstimatedCostUsd } from './call_metrics/calculate_estimated_cost.util';
import { CallTurnsRepository } from './call_turns.repository';
import { CallsRepository } from './calls.repository';
import { AddTurnDto } from './dto/add_turn.dto';
import { CreateCallDto } from './dto/create_call.dto';
import { EndCallDto } from './dto/end_call.dto';
import { RecordMetricsDto } from './dto/record_metrics.dto';
import { CallEndedError } from './errors/call_ended.error';
import { CallNotFoundError } from './errors/call_not_found.error';
import { CallDetail } from './types/call_detail.type';
import { CallMetrics } from './types/call_metrics.type';
import { CallChanges, CallRow } from './types/call_row.type';
import { CallTurn, NewCallTurn } from './types/call_turn.type';
import { LiveCall } from './types/live_call.type';

type CallEventName =
  | typeof LIVE_EVENT.CALL_STARTED
  | typeof LIVE_EVENT.CALL_UPDATED
  | typeof LIVE_EVENT.CALL_ENDED;

// Runs inside the transaction with the call row locked. Returns the column
// changes to apply, or null to leave the call untouched.
type CallChangeBuilder = (
  locked_call: CallRow,
  transaction: TransactionClient,
) => Promise<CallChanges | null> | CallChanges | null;

@Injectable()
export class CallsService {
  private readonly logger = new Logger(CallsService.name);

  constructor(
    private readonly database_service: DatabaseService,
    private readonly calls_repository: CallsRepository,
    private readonly call_turns_repository: CallTurnsRepository,
    private readonly interventions_repository: InterventionsRepository,
    private readonly audit_events_repository: AuditEventsRepository,
    private readonly engine_api_client: EngineApiClient,
    private readonly live_broadcaster: LiveBroadcaster,
    private readonly live_event_bus: LiveEventBus,
    @Inject(pricingConfig.KEY)
    private readonly pricing_config: ConfigType<typeof pricingConfig>,
  ) {}

  listLiveCalls(): Promise<LiveCall[]> {
    return this.calls_repository.findLiveCalls();
  }

  async getLiveCall(call_id: string): Promise<LiveCall> {
    const live_call = await this.calls_repository.findLiveCallById(call_id);
    if (!live_call) {
      throw new CallNotFoundError(call_id);
    }
    return live_call;
  }

  async getCallDetail(call_id: string): Promise<CallDetail> {
    const call = await this.getLiveCall(call_id);
    const [turns, interventions] = await Promise.all([
      this.call_turns_repository.findTurnsByCallId(call_id),
      this.interventions_repository.findByCallId(call_id),
    ]);
    return { call, turns, interventions };
  }

  async getActiveCall(call_id: string): Promise<CallRow> {
    const call_row = await this.calls_repository.findCallById(call_id);
    if (!call_row) {
      throw new CallNotFoundError(call_id);
    }
    if (call_row.status === 'ENDED') {
      throw new CallEndedError(call_id);
    }
    return call_row;
  }

  async createCall(create_call: CreateCallDto): Promise<LiveCall> {
    await this.endActiveCallsOfCaller(create_call.caller_number);
    const customer_lookup = await this.engine_api_client.lookupCustomer(
      create_call.caller_number,
    );
    const agent_id = await this.calls_repository.findLeastBusyOnlineAgentId();
    const default_mode =
      create_call.channel === 'SIMULATED' ? 'SCRIPTED' : 'LIVE';
    const actor: Actor = agent_id
      ? { actor_type: 'AI', actor_id: agent_id }
      : SYSTEM_ACTOR;
    const call_id = await this.database_service.runInTransaction(
      actor,
      (transaction) =>
        this.calls_repository.insertCall(transaction, {
          caller_number: create_call.caller_number,
          customer_id: customer_lookup.matched
            ? customer_lookup.customer_id
            : null,
          customer_name: customer_lookup.matched
            ? customer_lookup.full_name
            : null,
          channel: create_call.channel,
          handled_by_agent_id: agent_id,
          metrics: {
            mode: create_call.mode ?? default_mode,
            response_times_ms: [],
          },
        }),
    );
    const live_call = await this.getLiveCall(call_id);
    this.broadcastCall(LIVE_EVENT.CALL_STARTED, live_call);
    return live_call;
  }

  async addTurn(call_id: string, add_turn: AddTurnDto): Promise<CallTurn> {
    const call_row = await this.getActiveCall(call_id);
    const call_turn = await this.database_service.runInTransaction(
      this.buildSpeakerActor(call_row, add_turn.speaker),
      async (transaction) => {
        const locked_call = await this.lockActiveCall(transaction, call_id);
        if (add_turn.speaker === 'AI' && add_turn.latency_ms !== undefined) {
          await this.calls_repository.updateCall(transaction, call_id, {
            metrics: appendResponseTime(
              locked_call.metrics,
              add_turn.latency_ms,
            ),
          });
        }
        return this.call_turns_repository.insertTurn(transaction, {
          call_id,
          speaker: add_turn.speaker,
          text: add_turn.text,
          latency_ms: add_turn.latency_ms ?? null,
        });
      },
    );
    this.broadcastTurn(call_turn);
    await this.broadcastCallUpdated(call_id);
    return call_turn;
  }

  // For tool calls and supervisor effects: a turn written by another service
  // inside its own transaction (the call row must be locked there).
  insertTurnInTransaction(
    transaction: TransactionClient,
    new_turn: NewCallTurn,
  ): Promise<CallTurn> {
    return this.call_turns_repository.insertTurn(transaction, new_turn);
  }

  updateCallInTransaction(
    transaction: TransactionClient,
    call_id: string,
    call_changes: CallChanges,
  ): Promise<void> {
    return this.calls_repository.updateCall(transaction, call_id, call_changes);
  }

  findCaseAssignedStaffIdInTransaction(
    transaction: TransactionClient,
    case_number: string,
  ): Promise<string | null> {
    return this.calls_repository.findCaseAssignedStaffId(
      transaction,
      case_number,
    );
  }

  async recordMetrics(
    call_id: string,
    record_metrics: RecordMetricsDto,
  ): Promise<LiveCall> {
    return this.changeCall(call_id, SYSTEM_ACTOR, (locked_call) => {
      let metrics: CallMetrics = { ...locked_call.metrics };
      if (record_metrics.response_time_ms !== undefined) {
        metrics = appendResponseTime(metrics, record_metrics.response_time_ms);
      }
      if (record_metrics.usage) {
        metrics.usage = accumulateUsage(metrics.usage, record_metrics.usage);
        metrics.estimated_cost_usd = calculateEstimatedCostUsd(
          metrics.usage,
          this.pricing_config,
        );
      }
      return { metrics };
    });
  }

  // The realtime voice said something other than the text it was given.
  recordTtsDrift(call_id: string): Promise<LiveCall> {
    return this.changeCall(call_id, SYSTEM_ACTOR, (locked_call) => ({
      metrics: {
        ...locked_call.metrics,
        tts_drift_count: (locked_call.metrics.tts_drift_count ?? 0) + 1,
      },
    }));
  }

  // Runs `work` in one transaction with the call row locked, so everything
  // written for one call is serialised. Throws CallNotFoundError / CallEndedError.
  withLockedCall<Result>(
    call_id: string,
    actor: Actor,
    work: (
      locked_call: CallRow,
      transaction: TransactionClient,
    ) => Promise<Result>,
  ): Promise<Result> {
    return this.database_service.runInTransaction(
      actor,
      async (transaction) => {
        const locked_call = await this.lockActiveCall(transaction, call_id);
        return work(locked_call, transaction);
      },
    );
  }

  // Locks the call, applies the changes the builder returns and broadcasts
  // `call.updated`.
  async changeCall(
    call_id: string,
    actor: Actor,
    buildCallChanges: CallChangeBuilder,
  ): Promise<LiveCall> {
    await this.withLockedCall(
      call_id,
      actor,
      async (locked_call, transaction) => {
        const call_changes = await buildCallChanges(locked_call, transaction);
        if (call_changes) {
          await this.calls_repository.updateCall(
            transaction,
            call_id,
            call_changes,
          );
        }
      },
    );
    return this.broadcastCallUpdated(call_id);
  }

  async broadcastCallUpdated(call_id: string): Promise<LiveCall> {
    const live_call = await this.getLiveCall(call_id);
    this.broadcastCall(LIVE_EVENT.CALL_UPDATED, live_call);
    return live_call;
  }

  // Idempotent: ending an ended call returns it unchanged and emits nothing.
  async endCall(call_id: string, end_call: EndCallDto): Promise<LiveCall> {
    const actor = await this.buildEndingActor(call_id, end_call);
    const has_ended_now = await this.database_service.runInTransaction(
      actor,
      async (transaction) => {
        const locked_call = await this.calls_repository.findCallForUpdate(
          transaction,
          call_id,
        );
        if (!locked_call) {
          throw new CallNotFoundError(call_id);
        }
        if (locked_call.status === 'ENDED') {
          return false;
        }
        await this.markCallEnded(transaction, locked_call, end_call);
        return true;
      },
    );
    const live_call = await this.getLiveCall(call_id);
    if (has_ended_now) {
      this.broadcastCall(LIVE_EVENT.CALL_ENDED, live_call);
      this.live_event_bus.publish(INTERNAL_EVENT.CALL_ENDED, { call_id });
    }
    return live_call;
  }

  broadcastCall(event_name: CallEventName, live_call: LiveCall): void {
    this.live_broadcaster.emitToRooms(event_name, live_call, [
      STAFF_ROOM,
      buildCallRoom(live_call.call_id),
    ]);
  }

  broadcastTurn(call_turn: CallTurn): void {
    this.live_broadcaster.emitToRooms(LIVE_EVENT.CALL_TURN, call_turn, [
      STAFF_ROOM,
      buildCallRoom(call_turn.call_id),
    ]);
  }

  buildAgentActor(call_row: Pick<CallRow, 'handled_by_agent_id'>): Actor {
    return { actor_type: 'AI', actor_id: call_row.handled_by_agent_id };
  }

  private async lockActiveCall(
    transaction: TransactionClient,
    call_id: string,
  ): Promise<CallRow> {
    const locked_call = await this.calls_repository.findCallForUpdate(
      transaction,
      call_id,
    );
    if (!locked_call) {
      throw new CallNotFoundError(call_id);
    }
    if (locked_call.status === 'ENDED') {
      throw new CallEndedError(call_id);
    }
    return locked_call;
  }

  private async markCallEnded(
    transaction: TransactionClient,
    locked_call: CallRow,
    end_call: EndCallDto,
  ): Promise<void> {
    const ended_at = new Date();
    const time_to_resolution_ms = Math.max(
      ended_at.getTime() - new Date(locked_call.started_at).getTime(),
      0,
    );
    const call_cases = await this.calls_repository.findCasesByCallId(
      transaction,
      locked_call.call_id,
    );
    await this.calls_repository.updateCall(transaction, locked_call.call_id, {
      status: 'ENDED',
      ended_at,
      ai_summary: buildCallSummary(locked_call, call_cases),
      metrics: { ...locked_call.metrics, time_to_resolution_ms },
    });
    await this.audit_events_repository.insertEvent(transaction, {
      event_type: 'CALL_ENDED',
      call_id: locked_call.call_id,
      detail: {
        ended_by: end_call.ended_by,
        staff_id: end_call.staff_id ?? null,
        duration_ms: time_to_resolution_ms,
        case_numbers: call_cases.map((call_case) => call_case.case_number),
      },
    });
  }

  private async endActiveCallsOfCaller(caller_number: string): Promise<void> {
    const active_call_ids =
      await this.calls_repository.findActiveCallIdsByCallerNumber(
        caller_number,
      );
    for (const active_call_id of active_call_ids) {
      this.logger.log(
        `Ending call ${active_call_id}: the same caller started a new call`,
      );
      await this.endCall(active_call_id, { ended_by: 'SYSTEM' });
    }
  }

  private buildSpeakerActor(
    call_row: CallRow,
    speaker: AddTurnDto['speaker'],
  ): Actor {
    if (speaker === 'AI') {
      return this.buildAgentActor(call_row);
    }
    if (speaker === 'STAFF') {
      return { actor_type: 'STAFF', actor_id: call_row.assigned_staff_id };
    }
    return { actor_type: 'CUSTOMER', actor_id: call_row.customer_id };
  }

  private async buildEndingActor(
    call_id: string,
    end_call: EndCallDto,
  ): Promise<Actor> {
    if (end_call.ended_by === 'SYSTEM') {
      return SYSTEM_ACTOR;
    }
    if (end_call.ended_by === 'STAFF') {
      return { actor_type: 'STAFF', actor_id: end_call.staff_id ?? null };
    }
    const call_row = await this.calls_repository.findCallById(call_id);
    if (!call_row) {
      throw new CallNotFoundError(call_id);
    }
    return end_call.ended_by === 'AI'
      ? this.buildAgentActor(call_row)
      : { actor_type: 'CUSTOMER', actor_id: call_row.customer_id };
  }
}
