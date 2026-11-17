import { Injectable } from '@nestjs/common';

import { AuditRecorderService } from '../audit/audit_recorder.service';
import { AUDIT_EVENT_TYPES } from '../audit/constants/audit_event_type.constant';
import { CallRecordsService } from '../call_records/call_records.service';
import { CallerNotMatchedError } from '../call_records/errors/caller_not_matched.error';
import { DatabaseService } from '../database/database.service';
import { IDENTITY_METHODS } from '../identity_records/constants/identity_level.constant';
import { IdentityLockedError } from '../identity_records/errors/identity_locked.error';
import { IdentityRecordsService } from '../identity_records/identity_records.service';
import { TransactionClient } from '../database/types/transaction_client.type';
import { SYSTEM_ACTOR } from '../shared_kernel/constants/system_actor.constant';
import { clampLimit } from '../shared_kernel/utils/clamp_limit.util';
import {
  DEFAULT_NOTIFICATION_LIMIT,
  EXPIRED_STATUS,
  IDENTITY_CHECK_BODY,
  IDENTITY_CHECK_KIND,
  MAX_NOTIFICATION_LIMIT,
  SENT_STATUS,
} from './constants/notification_text.constant';
import { ListNotificationsQueryDto } from './dto/list_notifications_query.dto';
import { NotificationAlreadyRespondedError } from './errors/notification_already_responded.error';
import { NotificationNotAnswerableError } from './errors/notification_not_answerable.error';
import { NotificationNotFoundError } from './errors/notification_not_found.error';
import { NotificationsRepository } from './notifications.repository';
import { NotifierService } from './notifier.service';
import { NotificationRecord } from './types/notification.type';

const APP_PUSH_LEVEL = 1;

@Injectable()
export class NotificationsService {
  constructor(
    private readonly database: DatabaseService,
    private readonly notifications_repository: NotificationsRepository,
    private readonly notifier_service: NotifierService,
    private readonly call_records_service: CallRecordsService,
    private readonly identity_records_service: IdentityRecordsService,
    private readonly audit_recorder_service: AuditRecorderService,
  ) {}

  // The optional app check (send_app_identity_check), for callers who prefer
  // it: the caller-ID customer approves a push in their own banking app. It
  // grants identity level 1 only.
  async sendIdentityCheck(call_id: string): Promise<NotificationRecord> {
    const call_record = await this.call_records_service.getCall(call_id);
    const customer_id = call_record.customer_id;
    if (!customer_id) {
      throw new CallerNotMatchedError(call_id);
    }
    const identity_summary =
      await this.identity_records_service.summariseCall(call_id);
    if (identity_summary.is_locked) {
      throw new IdentityLockedError(call_id);
    }
    const notification = await this.database.runInTransaction(
      { actor_type: 'AI', actor_id: call_record.handled_by_agent_id },
      (transaction) =>
        this.notifier_service.sendNotification(transaction, {
          customer_id,
          call_id,
          case_number: null,
          channel: 'APP_PUSH',
          kind: 'IDENTITY_CHECK',
          body: IDENTITY_CHECK_BODY,
        }),
    );
    await this.notifier_service.publishCreated(notification);
    return notification;
  }

  async respondToNotification(
    notification_id: string,
    response: 'APPROVED' | 'DENIED',
  ): Promise<NotificationRecord> {
    const existing_notification = await this.getNotification(notification_id);
    const updated_notification = await this.database.runInTransaction(
      { actor_type: 'CUSTOMER', actor_id: existing_notification.customer_id },
      async (transaction) => {
        const locked_notification = await this.lockAnswerableNotification(
          transaction,
          notification_id,
        );
        const responded_notification =
          await this.notifications_repository.updateNotificationStatus(
            transaction,
            notification_id,
            response,
          );
        if (response === 'APPROVED' && locked_notification.call_id) {
          await this.identity_records_service.recordAppPushVerification(
            transaction,
            {
              call_id: locked_notification.call_id,
              customer_id: locked_notification.customer_id,
            },
          );
          await this.audit_recorder_service.recordEvent(transaction, {
            event_type: AUDIT_EVENT_TYPES.IDENTITY_VERIFIED,
            call_id: locked_notification.call_id,
            detail: {
              method: IDENTITY_METHODS.APP_PUSH,
              level: APP_PUSH_LEVEL,
              notification_id,
            },
          });
        }
        return responded_notification;
      },
    );
    await this.notifier_service.publishUpdated(updated_notification);
    return updated_notification;
  }

  async expireNotification(
    notification_id: string,
  ): Promise<NotificationRecord> {
    await this.getNotification(notification_id);
    const { notification, is_changed } = await this.database.runInTransaction(
      SYSTEM_ACTOR,
      async (transaction) => {
        const locked_notification =
          await this.notifications_repository.selectNotificationForUpdate(
            transaction,
            notification_id,
          );
        if (
          !locked_notification ||
          locked_notification.status !== SENT_STATUS
        ) {
          return { notification: locked_notification, is_changed: false };
        }
        const expired_notification =
          await this.notifications_repository.updateNotificationStatus(
            transaction,
            notification_id,
            EXPIRED_STATUS,
          );
        return { notification: expired_notification, is_changed: true };
      },
    );
    if (is_changed) {
      await this.notifier_service.publishUpdated(notification);
    }
    return notification as NotificationRecord;
  }

  listNotifications(notifications_query: ListNotificationsQueryDto) {
    return this.notifications_repository.selectNotifications(
      notifications_query,
      clampLimit(notifications_query.limit, {
        default_limit: DEFAULT_NOTIFICATION_LIMIT,
        max_limit: MAX_NOTIFICATION_LIMIT,
      }),
    );
  }

  listCaseNotifications(case_number: string) {
    return this.notifications_repository.selectNotifications(
      { case_number },
      MAX_NOTIFICATION_LIMIT,
    );
  }

  private async getNotification(
    notification_id: string,
  ): Promise<NotificationRecord> {
    const notification =
      await this.notifications_repository.selectNotification(notification_id);
    if (!notification) {
      throw new NotificationNotFoundError(notification_id);
    }
    return notification;
  }

  private async lockAnswerableNotification(
    transaction: TransactionClient,
    notification_id: string,
  ): Promise<NotificationRecord> {
    const locked_notification =
      await this.notifications_repository.selectNotificationForUpdate(
        transaction,
        notification_id,
      );
    if (!locked_notification) {
      throw new NotificationNotFoundError(notification_id);
    }
    if (locked_notification.kind !== IDENTITY_CHECK_KIND) {
      throw new NotificationNotAnswerableError(notification_id);
    }
    if (locked_notification.status !== SENT_STATUS) {
      throw new NotificationAlreadyRespondedError(
        notification_id,
        locked_notification.status,
      );
    }
    return locked_notification;
  }
}
