import { Injectable, Logger } from '@nestjs/common';

import { LIVE_EVENT } from '../live/constants/live_event_names.constant';
import {
  buildCallRoom,
  STAFF_ROOM,
} from '../live/constants/live_rooms.constant';
import { LiveBroadcaster } from '../live/live_broadcaster.service';
import { SYSTEM_ACTOR } from '../shared_kernel/types/actor.type';
import { CallsService } from './calls.service';
import { CallHoldEvent } from './types/call_hold_event.type';
import { CallHoldReason, CallHoldState } from './types/call_metrics.type';

export interface HoldStart {
  reason: CallHoldReason;
  tool_name: string;
}

// Keeps `metrics.hold` / `metrics.total_hold_ms` current and emits
// `call.hold`, so the dashboard and the phone show "On hold" consistently.
// A hold is cosmetic: a failure here is logged and never breaks a tool call.
@Injectable()
export class CallHoldService {
  private readonly logger = new Logger(CallHoldService.name);

  constructor(
    private readonly calls_service: CallsService,
    private readonly live_broadcaster: LiveBroadcaster,
  ) {}

  async startHold(call_id: string, hold_start: HoldStart): Promise<void> {
    const hold_state: CallHoldState = {
      is_on_hold: true,
      reason: hold_start.reason,
      tool_name: hold_start.tool_name,
      started_at: new Date().toISOString(),
    };
    try {
      await this.calls_service.changeCall(
        call_id,
        SYSTEM_ACTOR,
        (locked_call) => ({
          metrics: { ...locked_call.metrics, hold: hold_state },
        }),
      );
    } catch (error) {
      this.logger.warn(
        `Could not record the hold on call ${call_id}: ${(error as Error).message}`,
      );
    }
    this.emitHoldEvent({ call_id, ...hold_state, ended_at: null });
  }

  // Returns how long the hold lasted (0 when there was none).
  async endHold(call_id: string): Promise<number> {
    const ended_at = new Date();
    let ended_hold: CallHoldState | null = null;
    try {
      await this.calls_service.changeCall(
        call_id,
        SYSTEM_ACTOR,
        (locked_call) => {
          const current_hold = locked_call.metrics.hold;
          if (!current_hold?.is_on_hold) {
            return null;
          }
          ended_hold = current_hold;
          return {
            metrics: {
              ...locked_call.metrics,
              hold: { ...current_hold, is_on_hold: false },
              total_hold_ms:
                (locked_call.metrics.total_hold_ms ?? 0) +
                this.measureHoldMs(current_hold, ended_at),
            },
          };
        },
      );
    } catch (error) {
      this.logger.warn(
        `Could not record the end of the hold on call ${call_id}: ${(error as Error).message}`,
      );
    }
    const finished_hold = ended_hold as CallHoldState | null;
    if (!finished_hold) {
      return 0;
    }
    this.emitHoldEvent({
      call_id,
      ...finished_hold,
      is_on_hold: false,
      ended_at: ended_at.toISOString(),
    });
    return this.measureHoldMs(finished_hold, ended_at);
  }

  private measureHoldMs(hold_state: CallHoldState, ended_at: Date): number {
    return Math.max(
      ended_at.getTime() - new Date(hold_state.started_at).getTime(),
      0,
    );
  }

  private emitHoldEvent(call_hold_event: CallHoldEvent): void {
    this.live_broadcaster.emitToRooms(LIVE_EVENT.CALL_HOLD, call_hold_event, [
      STAFF_ROOM,
      buildCallRoom(call_hold_event.call_id),
    ]);
  }
}
