import { IsIn } from 'class-validator';

export const NOTIFICATION_RESPONSES = ['APPROVED', 'DENIED'] as const;

export class RespondToNotificationDto {
  @IsIn(NOTIFICATION_RESPONSES)
  response: (typeof NOTIFICATION_RESPONSES)[number];
}
