import { Body, Controller, Get, Param, Patch, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, RequirePermission } from '../../common/decorators/auth.decorators';
import type { IdentityContext } from '../../common/identity';
import type { RequestWithId } from '../../common/middleware/request-id.middleware';
import { AdminCommentsQuery, CommentModerationDto } from './dto/comments.dto';
import { CommentsService } from './comments.service';

@ApiTags('Admin Comments')
@ApiBearerAuth()
@Controller('admin/comments')
export class AdminCommentsController {
  constructor(private readonly comments: CommentsService) {}

  @RequirePermission('COMMENTS', 'READ')
  @Get()
  list(@Query() query: AdminCommentsQuery) {
    return this.comments.adminList(query);
  }

  @RequirePermission('COMMENTS', 'READ')
  @Get(':commentId')
  detail(@Param('commentId') commentId: string) {
    return this.comments.adminDetail(commentId);
  }

  @RequirePermission('COMMENTS', 'MODERATE')
  @Patch(':commentId/moderation')
  moderate(
    @Param('commentId') commentId: string,
    @CurrentUser() actor: IdentityContext,
    @Body() dto: CommentModerationDto,
    @Req() req: RequestWithId,
  ) {
    return this.comments.moderate(actor, commentId, dto, req.requestId);
  }
}
