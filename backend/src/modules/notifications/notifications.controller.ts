import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/auth.decorators';
import type { IdentityContext } from '../../common/identity';
import { NotificationMarkDto, NotificationsQuery } from './dto/notifications.dto';
import { NotificationsService } from './notifications.service';

@ApiTags('Notifications')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  list(@CurrentUser() actor: IdentityContext, @Query() query: NotificationsQuery) {
    return this.notifications.list(actor.userId, query);
  }

  @Get('unread-count')
  unreadCount(@CurrentUser() actor: IdentityContext) {
    return this.notifications.unreadCount(actor.userId);
  }

  @Post('read-all')
  readAll(@CurrentUser() actor: IdentityContext) {
    return this.notifications.readAll(actor.userId);
  }

  @Patch(':notificationId')
  mark(
    @CurrentUser() actor: IdentityContext,
    @Param('notificationId') notificationId: string,
    @Body() dto: NotificationMarkDto,
  ) {
    return this.notifications.mark(actor.userId, notificationId, dto.read);
  }
}
