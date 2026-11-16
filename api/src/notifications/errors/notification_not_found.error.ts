import { NotFoundException } from '@nestjs/common';

export class NotificationNotFoundError extends NotFoundException {
  readonly error_code = 'NOTIFICATION_NOT_FOUND';

  constructor(notification_id: string) {
    super(`Notification ${notification_id} was not found.`);
  }
}
