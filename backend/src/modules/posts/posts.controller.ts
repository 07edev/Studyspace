import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post as PostMethod, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, OptionalAuth } from '../../common/decorators/auth.decorators';
import type { IdentityContext } from '../../common/identity';
import { CreatePostDto, PatchPostDto, PostsQuery } from './dto/posts.dto';
import { PostsService } from './posts.service';

@ApiTags('Posts')
@ApiBearerAuth()
@Controller()
export class PostsController {
  constructor(private readonly posts: PostsService) {}

  @OptionalAuth()
  @Get('posts')
  feed(@Query() query: PostsQuery, @CurrentUser() actor?: IdentityContext) {
    return this.posts.feed(query, actor?.userId);
  }

  @OptionalAuth()
  @Get('posts/:postId')
  detail(@Param('postId') postId: string, @CurrentUser() actor?: IdentityContext) {
    return this.posts.detail(postId, actor?.userId);
  }

  @PostMethod('posts')
  create(@CurrentUser() actor: IdentityContext, @Body() dto: CreatePostDto) {
    return this.posts.create(actor.userId, dto);
  }

  @Get('users/me/posts')
  mine(@CurrentUser() actor: IdentityContext, @Query() query: PostsQuery) {
    return this.posts.mine(actor.userId, query);
  }

  @Get('users/me/saved-posts')
  saved(@CurrentUser() actor: IdentityContext, @Query() query: PostsQuery) {
    return this.posts.saved(actor.userId, query);
  }

  @Patch('posts/:postId')
  update(@CurrentUser() actor: IdentityContext, @Param('postId') postId: string, @Body() dto: PatchPostDto) {
    return this.posts.update(actor.userId, postId, dto);
  }

  @HttpCode(204)
  @Delete('posts/:postId')
  async remove(@CurrentUser() actor: IdentityContext, @Param('postId') postId: string) {
    await this.posts.remove(actor.userId, postId);
  }

  @Put('posts/:postId/likes/me')
  like(@CurrentUser() actor: IdentityContext, @Param('postId') postId: string) {
    return this.posts.like(actor.userId, postId);
  }

  @HttpCode(204)
  @Delete('posts/:postId/likes/me')
  async unlike(@CurrentUser() actor: IdentityContext, @Param('postId') postId: string) {
    await this.posts.unlike(actor.userId, postId);
  }

  @Put('posts/:postId/saves/me')
  save(@CurrentUser() actor: IdentityContext, @Param('postId') postId: string) {
    return this.posts.save(actor.userId, postId);
  }

  @HttpCode(204)
  @Delete('posts/:postId/saves/me')
  async unsave(@CurrentUser() actor: IdentityContext, @Param('postId') postId: string) {
    await this.posts.unsave(actor.userId, postId);
  }
}
