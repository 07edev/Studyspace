import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post as PostMethod, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, OptionalAuth } from '../../common/decorators/auth.decorators';
import type { IdentityContext } from '../../common/identity';
import { CommentsQuery, CreateCommentDto, PatchCommentDto } from './dto/comments.dto';
import { CommentsService } from './comments.service';

@ApiTags('Comments')
@ApiBearerAuth()
@Controller()
export class CommentsController {
  constructor(private readonly comments: CommentsService) {}

  @OptionalAuth()
  @Get('posts/:postId/comments')
  list(@Param('postId') postId: string, @Query() query: CommentsQuery) {
    return this.comments.list(postId, query);
  }

  @PostMethod('posts/:postId/comments')
  create(
    @Param('postId') postId: string,
    @CurrentUser() actor: IdentityContext,
    @Body() dto: CreateCommentDto,
  ) {
    return this.comments.create(postId, actor.userId, dto);
  }

  @Patch('comments/:commentId')
  update(
    @Param('commentId') commentId: string,
    @CurrentUser() actor: IdentityContext,
    @Body() dto: PatchCommentDto,
  ) {
    return this.comments.update(commentId, actor.userId, dto);
  }

  @HttpCode(204)
  @Delete('comments/:commentId')
  async remove(@Param('commentId') commentId: string, @CurrentUser() actor: IdentityContext) {
    await this.comments.remove(commentId, actor.userId);
  }
}
