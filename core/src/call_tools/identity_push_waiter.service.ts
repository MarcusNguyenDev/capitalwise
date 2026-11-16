import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';

import {
  INTERNAL_EVENT,
  LIVE_EVENT,
} from '../live/constants/live_event_names.constant';
import { LiveEventBus } from '../live/live_event_bus.service';
import { IDENTITY_PUSH_POLL_INTERVAL_MS } from './constants/identity_push.constant';
import { NotificationStatusesRepository } from './notification_statuses.repository';

export type IdentityPushAnswer =
  'APPROVED' | 'DENIED' | 'EXPIRED' | 'TIMEOUT' | 'CALL_GONE';

interface IdentityPushWait {
  notification_id: string;
  call_id: string;
  timeout_ms: number;
}

@Injectable()
export class IdentityPushWaiter implements OnModuleDestroy {
  private readonly logger = new Logger(IdentityPushWaiter.name);
  private readonly cancel_functions = new Set<() => void>();

  constructor(
    private readonly live_event_bus: LiveEventBus,
    private readonly notification_statuses_repository: NotificationStatusesRepository,
  ) {}

  onModuleDestroy(): void {
    for (const cancelWait of [...this.cancel_functions]) {
      cancelWait();
    }
  }

  // Resolves (never rejects) with the customer's answer, TIMEOUT, or CALL_GONE
  // when the call ended or the demo was reset while waiting.
  waitForAnswer(
    identity_push_wait: IdentityPushWait,
  ): Promise<IdentityPushAnswer> {
    return new Promise((resolve) => {
      const cleanup_functions: (() => void)[] = [];
      let is_settled = false;
      const settle = (identity_push_answer: IdentityPushAnswer) => {
        if (is_settled) {
          return;
        }
        is_settled = true;
        cleanup_functions.forEach((cleanUp) => cleanUp());
        this.cancel_functions.delete(cancelWait);
        resolve(identity_push_answer);
      };
      const cancelWait = () => settle('CALL_GONE');
      this.cancel_functions.add(cancelWait);

      const settleFromStatus = (status: string | undefined) => {
        if (
          status === 'APPROVED' ||
          status === 'DENIED' ||
          status === 'EXPIRED'
        ) {
          settle(status);
        }
      };

      cleanup_functions.push(
        this.live_event_bus.subscribe<{
          notification_id?: string;
          status?: string;
        }>(LIVE_EVENT.NOTIFICATION_UPDATED, (notification) => {
          if (
            notification.notification_id === identity_push_wait.notification_id
          ) {
            settleFromStatus(notification.status);
          }
        }),
        this.live_event_bus.subscribe<{ call_id: string }>(
          INTERNAL_EVENT.CALL_ENDED,
          (ended_call) => {
            if (ended_call.call_id === identity_push_wait.call_id) {
              settle('CALL_GONE');
            }
          },
        ),
        this.live_event_bus.subscribe(LIVE_EVENT.DEMO_RESET, () =>
          settle('CALL_GONE'),
        ),
      );

      const timeout_timer = setTimeout(
        () => settle('TIMEOUT'),
        identity_push_wait.timeout_ms,
      );
      const poll_timer = setInterval(() => {
        this.notification_statuses_repository
          .findStatus(identity_push_wait.notification_id)
          .then(settleFromStatus)
          .catch((error: Error) =>
            this.logger.warn(`Notification poll failed: ${error.message}`),
          );
      }, IDENTITY_PUSH_POLL_INTERVAL_MS);
      cleanup_functions.push(
        () => clearTimeout(timeout_timer),
        () => clearInterval(poll_timer),
      );
    });
  }
}
