import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser, Public } from '../../common/decorators/auth.decorators';
import type { IdentityContext } from '../../common/identity';
import {
  NotificationDevice,
  NotificationSettingsDto,
  PrivacySettingsDto,
  ProfilePatch,
} from './dto/users.dto';
import { UsersService } from './users.service';

@ApiTags('Users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('me')
  me(@CurrentUser() actor: IdentityContext) {
    return this.users.me(actor.userId);
  }

  @Patch('me/profile')
  patchProfile(@CurrentUser() actor: IdentityContext, @Body() dto: ProfilePatch) {
    return this.users.patchProfile(actor.userId, dto);
  }

  @Get('me/privacy')
  privacy(@CurrentUser() actor: IdentityContext) {
    return this.users.getPrivacy(actor.userId);
  }

  @Patch('me/privacy')
  patchPrivacy(@CurrentUser() actor: IdentityContext, @Body() dto: PrivacySettingsDto) {
    return this.users.patchPrivacy(actor.userId, dto);
  }

  @Get('me/notification-settings')
  notificationSettings(@CurrentUser() actor: IdentityContext) {
    return this.users.getNotificationSettings(actor.userId);
  }

  @Patch('me/notification-settings')
  patchNotificationSettings(
    @CurrentUser() actor: IdentityContext,
    @Body() dto: NotificationSettingsDto,
  ) {
    return this.users.patchNotificationSettings(actor.userId, dto);
  }

  @Post('me/devices')
  registerDevice(@CurrentUser() actor: IdentityContext, @Body() dto: NotificationDevice) {
    return this.users.registerDevice(actor.userId, dto);
  }

  @HttpCode(204)
  @Delete('me/devices/:deviceId')
  async removeDevice(@CurrentUser() actor: IdentityContext, @Param('deviceId') deviceId: string) {
    await this.users.removeDevice(actor.userId, deviceId);
  }

  @Public()
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @Get(':userId/public-profile')
  publicProfile(@Param('userId') userId: string) {
    return this.users.publicProfile(userId);
  }
}
