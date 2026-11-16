import { ConflictException } from '@nestjs/common';

export class NotificationAlreadyRespondedError extends ConflictException {
  readonly error_code = 'NOTIFICATION_ALREADY_RESPONDED';

  constructor(notification_id: string, status: string) {
    super(
      `Notification ${notification_id} can no longer be answered (status ${status}).`,
    );
  }
}
