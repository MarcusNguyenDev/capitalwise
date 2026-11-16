import { ConflictException } from '@nestjs/common';

export class NotificationNotAnswerableError extends ConflictException {
  readonly error_code = 'NOTIFICATION_NOT_ANSWERABLE';

  constructor(notification_id: string) {
    super(
      `Notification ${notification_id} is an update, not an identity check, so it cannot be approved or denied.`,
    );
  }
}
