import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
} from '@nestjs/common';

import { ListNotificationsQueryDto } from './dto/list_notifications_query.dto';
import { RespondToNotificationDto } from './dto/respond_to_notification.dto';
import { SendIdentityCheckDto } from './dto/send_identity_check.dto';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications_service: NotificationsService) {}

  @Post('identity_check')
  sendIdentityCheck(@Body() identity_check: SendIdentityCheckDto) {
    return this.notifications_service.sendIdentityCheck(identity_check.call_id);
  }

  @Post(':notification_id/response')
  @HttpCode(HttpStatus.OK)
  respondToNotification(
    @Param('notification_id') notification_id: string,
    @Body() notification_response: RespondToNotificationDto,
  ) {
    return this.notifications_service.respondToNotification(
      notification_id,
      notification_response.response,
    );
  }

  @Post(':notification_id/expire')
  @HttpCode(HttpStatus.OK)
  expireNotification(@Param('notification_id') notification_id: string) {
    return this.notifications_service.expireNotification(notification_id);
  }

  @Get()
  listNotifications(@Query() notifications_query: ListNotificationsQueryDto) {
    return this.notifications_service.listNotifications(notifications_query);
  }
}
