import { Body, Controller, Get, Param, Patch, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, RequirePermission } from '../../common/decorators/auth.decorators';
import type { IdentityContext } from '../../common/identity';
import type { RequestWithId } from '../../common/middleware/request-id.middleware';
import { PostModerationDto, PostsQuery } from './dto/posts.dto';
import { PostsService } from './posts.service';

@ApiTags('Admin Posts')
@ApiBearerAuth()
@Controller('admin/posts')
export class AdminPostsController {
  constructor(private readonly posts: PostsService) {}

  @RequirePermission('POSTS', 'READ')
  @Get()
  list(@Query() query: PostsQuery) {
    return this.posts.adminList(query);
  }

  @RequirePermission('POSTS', 'READ')
  @Get(':postId')
  detail(@Param('postId') postId: string) {
    return this.posts.adminDetail(postId);
  }

  @RequirePermission('POSTS', 'MODERATE')
  @Patch(':postId/moderation')
  moderate(
    @Param('postId') postId: string,
    @CurrentUser() actor: IdentityContext,
    @Body() dto: PostModerationDto,
    @Req() req: RequestWithId,
  ) {
    return this.posts.moderate(actor, postId, dto, req.requestId);
  }
}
