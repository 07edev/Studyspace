import { Body, Controller, Get, HttpCode, Param, Patch, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, RequirePermission } from '../../common/decorators/auth.decorators';
import type { IdentityContext } from '../../common/identity';
import type { RequestWithId } from '../../common/middleware/request-id.middleware';
import { PageQuery } from '../../common/utils/page';
import { AdminUsersService } from './admin-users.service';
import { AdminUserListQuery, AdminUserStatusDto } from './dto/admin-users.dto';

@ApiTags('AdminUsers')
@ApiBearerAuth()
@RequirePermission('USERS', 'READ')
@Controller('admin/users')
export class AdminUsersController {
  constructor(private readonly service: AdminUsersService) {}

  @Get()
  list(@Query() query: AdminUserListQuery) {
    return this.service.list(query);
  }

  @Get(':userId')
  detail(@Param('userId') userId: string) {
    return this.service.detail(userId);
  }

  @RequirePermission('USERS', 'UPDATE')
  @HttpCode(200)
  @Patch(':userId/status')
  status(
    @CurrentUser() actor: IdentityContext,
    @Param('userId') userId: string,
    @Body() dto: AdminUserStatusDto,
    @Req() req: RequestWithId,
  ) {
    return this.service.changeStatus(actor, userId, dto, req.requestId);
  }

  @Get(':userId/activity')
  activity(@Param('userId') userId: string, @Query() query: PageQuery) {
    return this.service.activity(userId, query);
  }

  @Get(':userId/violations')
  violations(@Param('userId') userId: string, @Query() query: PageQuery) {
    return this.service.violations(userId, query);
  }

  @Get(':userId/posts')
  posts(@Param('userId') userId: string, @Query() query: PageQuery) {
    return this.service.contentOf('posts', userId, query);
  }

  @Get(':userId/documents')
  documents(@Param('userId') userId: string, @Query() query: PageQuery) {
    return this.service.contentOf('documents', userId, query);
  }

  @Get(':userId/reviews')
  reviews(@Param('userId') userId: string, @Query() query: PageQuery) {
    return this.service.contentOf('reviews', userId, query);
  }

  @Get(':userId/suggestions')
  suggestions(@Param('userId') userId: string, @Query() query: PageQuery) {
    return this.service.contentOf('suggestions', userId, query);
  }
}
