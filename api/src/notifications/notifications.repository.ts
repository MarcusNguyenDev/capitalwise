import { Injectable } from '@nestjs/common';

import { DatabaseService } from '../database/database.service';
import { TransactionClient } from '../database/types/transaction_client.type';
import { NewNotification, NotificationRecord } from './types/notification.type';

export interface NotificationFilters {
  customer_id?: string;
  call_id?: string;
  case_number?: string;
}

@Injectable()
export class NotificationsRepository {
  constructor(private readonly database: DatabaseService) {}

  async insertNotification(
    transaction: TransactionClient,
    new_notification: NewNotification,
  ): Promise<NotificationRecord> {
    const notification_rows = await transaction.query<NotificationRecord>(
      `INSERT INTO engine.notifications (customer_id, call_id, case_number, channel, kind, body)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        new_notification.customer_id,
        new_notification.call_id,
        new_notification.case_number,
        new_notification.channel,
        new_notification.kind,
        new_notification.body,
      ],
    );
    return notification_rows[0];
  }

  async selectNotificationForUpdate(
    transaction: TransactionClient,
    notification_id: string,
  ): Promise<NotificationRecord | null> {
    const notification_rows = await transaction.query<NotificationRecord>(
      `SELECT * FROM engine.notifications WHERE notification_id = $1 FOR UPDATE`,
      [notification_id],
    );
    return notification_rows[0] ?? null;
  }

  async selectNotification(
    notification_id: string,
  ): Promise<NotificationRecord | null> {
    const notification_rows = await this.database.query<NotificationRecord>(
      `SELECT * FROM engine.notifications WHERE notification_id = $1`,
      [notification_id],
    );
    return notification_rows[0] ?? null;
  }

  async updateNotificationStatus(
    transaction: TransactionClient,
    notification_id: string,
    notification_status: string,
  ): Promise<NotificationRecord> {
    const notification_rows = await transaction.query<NotificationRecord>(
      `UPDATE engine.notifications SET status = $2, responded_at = now()
       WHERE notification_id = $1
       RETURNING *`,
      [notification_id, notification_status],
    );
    return notification_rows[0];
  }

  selectNotifications(
    filters: NotificationFilters,
    row_limit: number,
  ): Promise<NotificationRecord[]> {
    return this.database.query<NotificationRecord>(
      `SELECT * FROM engine.notifications
       WHERE ($1::text IS NULL OR customer_id = $1)
         AND ($2::uuid IS NULL OR call_id = $2::uuid)
         AND ($3::text IS NULL OR case_number = $3)
       ORDER BY created_at DESC, notification_id DESC
       LIMIT $4`,
      [
        filters.customer_id ?? null,
        filters.call_id ?? null,
        filters.case_number ?? null,
        row_limit,
      ],
    );
  }
}
