import { Injectable, Logger } from '@nestjs/common';

import { CallsService } from '../../calls/calls.service';
import { readIdentityLevel } from '../../calls/read_identity_level.util';
import { CallRow } from '../../calls/types/call_row.type';
import { EngineApiClient } from '../../engine_api/engine_api.client';
import { INTERNAL_EVENT } from '../../live/constants/live_event_names.constant';
import { LiveEventBus } from '../../live/live_event_bus.service';
import { IDENTITY_PUSH_TIMEOUT_MS } from '../constants/identity_push.constant';
import { IdentityPushWaiter } from '../identity_push_waiter.service';
import { ToolContext } from '../types/tool_context.type';

@Injectable()
export class CallerIdentityToolsHandler {
  private readonly logger = new Logger(CallerIdentityToolsHandler.name);

  constructor(
    private readonly engine_api_client: EngineApiClient,
    private readonly calls_service: CallsService,
    private readonly identity_push_waiter: IdentityPushWaiter,
    private readonly live_event_bus: LiveEventBus,
  ) {}

  async getCallerContext(
    tool_context: ToolContext,
  ): Promise<Record<string, unknown>> {
    const customer_lookup = await this.engine_api_client.lookupCustomer(
      tool_context.call.caller_number,
    );
    // Only a hint: never the name, so the model cannot greet a caller by a
    // name they have not confirmed (a spouse may use the same phone).
    return { is_known_number: customer_lookup.matched };
  }

  // The optional app method: grants identity level 1 only.
  async sendAppIdentityCheck(
    tool_context: ToolContext,
  ): Promise<Record<string, unknown>> {
    const { call } = tool_context;
    const current_level = readIdentityLevel(call);
    if (current_level >= 1) {
      return { verified: true, identity_level: current_level };
    }
    const notification = await this.engine_api_client.createIdentityCheck(
      call.call_id,
    );
    const answer_promise = this.identity_push_waiter.waitForAnswer({
      notification_id: notification.notification_id,
      call_id: call.call_id,
      timeout_ms: IDENTITY_PUSH_TIMEOUT_MS,
    });
    // The simulator listens for this to tap "Approve" for its own callers.
    this.live_event_bus.publish(INTERNAL_EVENT.IDENTITY_PUSH_SENT, {
      call_id: call.call_id,
      notification_id: notification.notification_id,
    });
    const identity_push_answer = await answer_promise;

    if (identity_push_answer === 'APPROVED') {
      await this.markIdentityVerified(call);
      // The app on file belongs to the caller-ID customer.
      const first_name = call.customer_name?.split(' ')[0] ?? null;
      return { verified: true, identity_level: 1, first_name };
    }
    if (identity_push_answer === 'DENIED') {
      await this.raiseRiskAfterDenial(call);
      return { verified: false, reason: 'DENIED' };
    }
    if (identity_push_answer === 'TIMEOUT') {
      await this.expireNotificationQuietly(notification.notification_id);
    }
    return {
      verified: false,
      reason: identity_push_answer === 'CALL_GONE' ? 'CALL_ENDED' : 'TIMEOUT',
    };
  }

  private async markIdentityVerified(call: CallRow): Promise<void> {
    await this.calls_service.changeCall(
      call.call_id,
      { actor_type: 'CUSTOMER', actor_id: call.customer_id },
      (locked_call) => {
        // The caller may have answered the questions meanwhile.
        if (readIdentityLevel(locked_call) >= 1) {
          return null;
        }
        const verified_at = new Date();
        return {
          identity_verified: true,
          identity_level: 1,
          identity_method: 'APP_PUSH',
          verified_at,
          metrics: {
            ...locked_call.metrics,
            time_to_identity_ms:
              verified_at.getTime() -
              new Date(locked_call.started_at).getTime(),
          },
        };
      },
    );
  }

  private async raiseRiskAfterDenial(call: CallRow): Promise<void> {
    await this.calls_service.changeCall(
      call.call_id,
      { actor_type: 'CUSTOMER', actor_id: call.customer_id },
      (locked_call) =>
        locked_call.risk_level === 'LOW' ? { risk_level: 'MEDIUM' } : null,
    );
  }

  private async expireNotificationQuietly(
    notification_id: string,
  ): Promise<void> {
    try {
      await this.engine_api_client.expireNotification(notification_id);
    } catch (error) {
      this.logger.warn(
        `Could not expire notification ${notification_id}: ${(error as Error).message}`,
      );
    }
  }
}
