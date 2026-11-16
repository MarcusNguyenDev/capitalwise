import { Injectable, Logger } from '@nestjs/common';

import { AuditEventsRepository } from '../audit/audit_events.repository';
import { CallsService } from '../calls/calls.service';
import { CallMetrics } from '../calls/types/call_metrics.type';
import { CallChanges, CallRow } from '../calls/types/call_row.type';
import { CallTurn } from '../calls/types/call_turn.type';
import { TransactionClient } from '../database/types/transaction_client.type';
import { EngineApiClient } from '../engine_api/engine_api.client';
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
import { Actor } from '../shared_kernel/types/actor.type';
import { CreateInterventionDto } from './dto/create_intervention.dto';
import { SendStaffMessageDto } from './dto/send_staff_message.dto';
import { CallNotWithHumanError } from './errors/call_not_with_human.error';
import { InterventionNotApplicableError } from './errors/intervention_not_applicable.error';
import { InterventionNotFoundError } from './errors/intervention_not_found.error';
import { InterventionTextRequiredError } from './errors/intervention_text_required.error';
import { StaffNotFoundError } from './errors/staff_not_found.error';
import { InterventionsRepository } from './interventions.repository';
import { StaffUser, StaffUsersRepository } from './staff_users.repository';
import { CallCommand, CallCommandName } from './types/call_command.type';
import {
  Intervention,
  InterventionType,
  InterventionWithStaff,
} from './types/intervention.type';

const MONITOR_DEDUPE_WINDOW_SECONDS = 60;
const TEXT_REQUIRED_TYPES: InterventionType[] = ['INSTRUCTION', 'HANDBACK'];

interface InterventionEffect {
  call_changes: CallChanges | null;
  system_turn_text: string | null;
  audit_event_type: 'TAKEOVER' | 'HANDBACK' | null;
}

interface RecordedIntervention {
  intervention: Intervention;
  system_turn: CallTurn | null;
}

function readFirstName(full_name: string): string {
  return full_name.split(' ')[0];
}

@Injectable()
export class InterventionsService {
  private readonly logger = new Logger(InterventionsService.name);

  constructor(
    private readonly calls_service: CallsService,
    private readonly interventions_repository: InterventionsRepository,
    private readonly staff_users_repository: StaffUsersRepository,
    private readonly audit_events_repository: AuditEventsRepository,
    private readonly engine_api_client: EngineApiClient,
    private readonly live_broadcaster: LiveBroadcaster,
    private readonly live_event_bus: LiveEventBus,
  ) {}

  async createIntervention(
    call_id: string,
    create_intervention: CreateInterventionDto,
  ): Promise<InterventionWithStaff> {
    const intervention_text = create_intervention.text?.trim() || null;
    if (
      TEXT_REQUIRED_TYPES.includes(create_intervention.type) &&
      !intervention_text
    ) {
      throw new InterventionTextRequiredError(create_intervention.type);
    }
    await this.calls_service.getActiveCall(call_id);
    const staff_user = await this.getStaffUser(create_intervention.staff_id);

    if (create_intervention.type === 'MONITOR') {
      const recent_monitor =
        await this.interventions_repository.findRecentMonitor(
          call_id,
          staff_user.staff_id,
          MONITOR_DEDUPE_WINDOW_SECONDS,
        );
      if (recent_monitor) {
        return recent_monitor;
      }
    }

    const recorded_intervention = await this.recordIntervention(staff_user, {
      call_id,
      type: create_intervention.type,
      text: intervention_text,
    });
    const intervention_with_staff: InterventionWithStaff = {
      ...recorded_intervention.intervention,
      staff_name: staff_user.name,
    };
    await this.publishIntervention(
      intervention_with_staff,
      recorded_intervention,
    );
    return intervention_with_staff;
  }

  // The phone (or the simulator) confirms it injected the instruction.
  async markInstructionApplied(
    call_id: string,
    intervention_id: string,
  ): Promise<CallTurn | null> {
    const intervention =
      await this.interventions_repository.findById(intervention_id);
    if (!intervention || intervention.call_id !== call_id) {
      throw new InterventionNotFoundError(intervention_id, call_id);
    }
    if (!TEXT_REQUIRED_TYPES.includes(intervention.type)) {
      throw new InterventionNotApplicableError(
        intervention_id,
        intervention.type,
      );
    }
    const call = await this.calls_service.getActiveCall(call_id);
    const system_turn = await this.calls_service.withLockedCall(
      call_id,
      this.calls_service.buildAgentActor(call),
      (_locked_call, transaction) =>
        this.recordInstructionApplied(transaction, intervention),
    );
    if (system_turn) {
      this.calls_service.broadcastTurn(system_turn);
    }
    return system_turn;
  }

  // The typed fallback for a takeover: the phone speaks the text aloud.
  async sendStaffMessage(
    call_id: string,
    send_staff_message: SendStaffMessageDto,
  ): Promise<CallTurn> {
    const staff_user = await this.getStaffUser(send_staff_message.staff_id);
    const staff_turn = await this.calls_service.withLockedCall(
      call_id,
      { actor_type: 'STAFF', actor_id: staff_user.staff_id },
      (locked_call, transaction) => {
        if (locked_call.status !== 'HUMAN_ACTIVE') {
          throw new CallNotWithHumanError(call_id);
        }
        return this.calls_service.insertTurnInTransaction(transaction, {
          call_id,
          speaker: 'STAFF',
          text: send_staff_message.text,
        });
      },
    );
    this.calls_service.broadcastTurn(staff_turn);
    await this.calls_service.broadcastCallUpdated(call_id);
    this.emitCallCommand({
      call_id,
      command: 'STAFF_MESSAGE',
      text: send_staff_message.text,
      staff_id: staff_user.staff_id,
      staff_name: staff_user.name,
      intervention_id: null,
    });
    return staff_turn;
  }

  private async getStaffUser(staff_id: string): Promise<StaffUser> {
    const staff_user = await this.staff_users_repository.findById(staff_id);
    if (!staff_user) {
      throw new StaffNotFoundError(staff_id);
    }
    return staff_user;
  }

  private recordIntervention(
    staff_user: StaffUser,
    new_intervention: {
      call_id: string;
      type: InterventionType;
      text: string | null;
    },
  ): Promise<RecordedIntervention> {
    const staff_actor: Actor = {
      actor_type: 'STAFF',
      actor_id: staff_user.staff_id,
    };
    return this.calls_service.withLockedCall(
      new_intervention.call_id,
      staff_actor,
      async (locked_call, transaction) => {
        const intervention_effect = this.buildEffect(
          locked_call,
          staff_user,
          new_intervention.type,
        );
        const intervention =
          await this.interventions_repository.insertIntervention(transaction, {
            ...new_intervention,
            staff_id: staff_user.staff_id,
          });
        const system_turn = await this.applyEffect(
          transaction,
          intervention,
          intervention_effect,
        );
        return { intervention, system_turn };
      },
    );
  }

  private buildEffect(
    locked_call: CallRow,
    staff_user: StaffUser,
    intervention_type: InterventionType,
  ): InterventionEffect {
    if (intervention_type === 'TAKEOVER') {
      return {
        call_changes: {
          status: 'HUMAN_ACTIVE',
          assigned_staff_id: staff_user.staff_id,
          metrics: this.addTimeToHuman(locked_call),
        },
        system_turn_text: `${staff_user.name} from our team joined the call`,
        audit_event_type: 'TAKEOVER',
      };
    }
    if (intervention_type === 'HANDBACK') {
      if (locked_call.status !== 'HUMAN_ACTIVE') {
        throw new CallNotWithHumanError(locked_call.call_id);
      }
      return {
        call_changes: { status: 'AI_ACTIVE', attention_reason: null },
        system_turn_text: 'Call handed back to the AI specialist',
        audit_event_type: 'HANDBACK',
      };
    }
    return {
      call_changes: null,
      system_turn_text: null,
      audit_event_type: null,
    };
  }

  // Time from the moment a human was requested (request_human / flag_concern)
  // to the takeover. Only the first takeover counts.
  private addTimeToHuman(locked_call: CallRow): CallMetrics {
    const { human_requested_at, time_to_human_ms } = locked_call.metrics;
    if (!human_requested_at || typeof time_to_human_ms === 'number') {
      return locked_call.metrics;
    }
    return {
      ...locked_call.metrics,
      time_to_human_ms: Math.max(
        Date.now() - new Date(human_requested_at).getTime(),
        0,
      ),
    };
  }

  private async applyEffect(
    transaction: TransactionClient,
    intervention: Intervention,
    intervention_effect: InterventionEffect,
  ): Promise<CallTurn | null> {
    if (intervention_effect.call_changes) {
      await this.calls_service.updateCallInTransaction(
        transaction,
        intervention.call_id,
        intervention_effect.call_changes,
      );
    }
    if (intervention_effect.audit_event_type) {
      await this.audit_events_repository.insertEvent(transaction, {
        event_type: intervention_effect.audit_event_type,
        call_id: intervention.call_id,
        detail: {
          intervention_id: intervention.intervention_id,
          staff_id: intervention.staff_id,
          text: intervention.text,
        },
      });
    }
    if (!intervention_effect.system_turn_text) {
      return null;
    }
    return this.calls_service.insertTurnInTransaction(transaction, {
      call_id: intervention.call_id,
      speaker: 'SYSTEM',
      text: intervention_effect.system_turn_text,
    });
  }

  private async recordInstructionApplied(
    transaction: TransactionClient,
    intervention: InterventionWithStaff,
  ): Promise<CallTurn | null> {
    // Idempotent: a phone that confirms twice produces one audit event.
    const is_already_applied =
      await this.audit_events_repository.hasInstructionAppliedEvent(
        transaction,
        intervention.intervention_id,
      );
    if (is_already_applied) {
      return null;
    }
    await this.audit_events_repository.insertEvent(transaction, {
      event_type: 'INSTRUCTION_APPLIED',
      call_id: intervention.call_id,
      detail: {
        intervention_id: intervention.intervention_id,
        staff_id: intervention.staff_id,
        text: intervention.text,
      },
    });
    return this.calls_service.insertTurnInTransaction(transaction, {
      call_id: intervention.call_id,
      speaker: 'SYSTEM',
      text: `Instruction applied: ${intervention.text}`,
    });
  }

  private async publishIntervention(
    intervention: InterventionWithStaff,
    recorded_intervention: RecordedIntervention,
  ): Promise<void> {
    const { call_id, type } = intervention;
    this.live_broadcaster.emitToRooms(
      LIVE_EVENT.CALL_INTERVENTION,
      intervention,
      [STAFF_ROOM],
    );
    if (recorded_intervention.system_turn) {
      this.calls_service.broadcastTurn(recorded_intervention.system_turn);
    }
    if (type === 'TAKEOVER') {
      await this.closeCallbackCases(intervention);
    }
    if (type === 'END_CALL') {
      await this.calls_service.endCall(call_id, {
        ended_by: 'STAFF',
        staff_id: intervention.staff_id,
      });
    } else if (type === 'TAKEOVER' || type === 'HANDBACK') {
      await this.calls_service.broadcastCallUpdated(call_id);
    }
    if (type !== 'MONITOR') {
      this.emitCallCommand({
        call_id,
        command: type as CallCommandName,
        text: this.buildCommandText(intervention),
        staff_id: intervention.staff_id,
        staff_name: intervention.staff_name,
        intervention_id: intervention.intervention_id,
      });
    }
    this.live_event_bus.publish(
      INTERNAL_EVENT.INTERVENTION_RECORDED,
      intervention,
    );
  }

  private buildCommandText(intervention: InterventionWithStaff): string | null {
    if (intervention.type === 'TAKEOVER') {
      return `You're now speaking with ${readFirstName(intervention.staff_name)} from our team`;
    }
    return intervention.text;
  }

  // A failure here must not undo the takeover: the human is already on the call.
  private async closeCallbackCases(intervention: Intervention): Promise<void> {
    try {
      await this.engine_api_client.notifyHumanJoined({
        call_id: intervention.call_id,
        staff_id: intervention.staff_id,
      });
    } catch (error) {
      this.logger.warn(
        `Could not tell the api service a human joined call ${intervention.call_id}: ${(error as Error).message}`,
      );
    }
  }

  private emitCallCommand(call_command: CallCommand): void {
    this.live_broadcaster.emitToRooms(LIVE_EVENT.CALL_COMMAND, call_command, [
      buildCallRoom(call_command.call_id),
    ]);
  }
}
