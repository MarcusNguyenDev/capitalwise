import { Injectable } from '@nestjs/common';

import { DatabaseService } from '../database/database.service';
import { NotificationStatus } from '../engine_api/types/notification.type';

// engine.notifications belongs to the api service; core only reads it.
@Injectable()
export class NotificationStatusesRepository {
  constructor(private readonly database_service: DatabaseService) {}

  async findStatus(
    notification_id: string,
  ): Promise<NotificationStatus | undefined> {
    const rows = await this.database_service.query<{
      status: NotificationStatus;
    }>(`SELECT status FROM engine.notifications WHERE notification_id = $1`, [
      notification_id,
    ]);
    return rows[0]?.status;
  }
}
