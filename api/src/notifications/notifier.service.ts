import { Injectable } from '@nestjs/common';

import { TransactionClient } from '../database/types/transaction_client.type';
import { UNKNOWN_CUSTOMER_ID } from '../facts/constants/action_code.constant';
import {
  buildCustomerRoom,
  STAFF_ROOM,
} from '../live_events/constants/live_events_channel.constant';
import { LiveEventsPublisher } from '../live_events/live_events.publisher';
import {
  buildCaseCreatedSms,
  buildCaseDecidedSms,
} from './case_update_messages';
import { NotificationsRepository } from './notifications.repository';
import {
  CaseMessageContext,
  NewNotification,
  NotificationRecord,
} from './types/notification.type';

// Writes customer notifications and pushes them to the simulated phone.
// Inserts happen inside the caller's transaction; publishing happens after
// the commit so nobody is told about something that then rolls back.
@Injectable()
export class NotifierService {
  constructor(
    private readonly notifications_repository: NotificationsRepository,
    private readonly live_events_publisher: LiveEventsPublisher,
  ) {}

  sendNotification(
    transaction: TransactionClient,
    new_notification: NewNotification,
  ): Promise<NotificationRecord> {
    return this.notifications_repository.insertNotification(
      transaction,
      new_notification,
    );
  }

  notifyCaseCreated(
    transaction: TransactionClient,
    message_context: CaseMessageContext,
  ): Promise<NotificationRecord | null> {
    return this.sendCaseSms(
      transaction,
      message_context,
      buildCaseCreatedSms(message_context),
    );
  }

  notifyCaseDecided(
    transaction: TransactionClient,
    message_context: CaseMessageContext,
  ): Promise<NotificationRecord | null> {
    return this.sendCaseSms(
      transaction,
      message_context,
      buildCaseDecidedSms(message_context),
    );
  }

  async publishCreated(notification: NotificationRecord | null): Promise<void> {
    await this.publishNotification('notification.created', notification);
  }

  async publishUpdated(notification: NotificationRecord | null): Promise<void> {
    await this.publishNotification('notification.updated', notification);
  }

  private sendCaseSms(
    transaction: TransactionClient,
    message_context: CaseMessageContext,
    sms_body: string | null,
  ): Promise<NotificationRecord | null> {
    if (!sms_body || message_context.customer_id === UNKNOWN_CUSTOMER_ID) {
      return Promise.resolve(null);
    }
    return this.sendNotification(transaction, {
      customer_id: message_context.customer_id,
      call_id: message_context.call_id,
      case_number: message_context.case_number,
      channel: 'SMS',
      kind: 'CASE_UPDATE',
      body: sms_body,
    });
  }

  private async publishNotification(
    event: string,
    notification: NotificationRecord | null,
  ): Promise<void> {
    if (!notification) {
      return;
    }
    await this.live_events_publisher.publish({
      event,
      payload: notification,
      rooms: [STAFF_ROOM, buildCustomerRoom(notification.customer_id)],
    });
  }
}
