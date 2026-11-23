import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, OptionalAuth } from '../../common/decorators/auth.decorators';
import type { IdentityContext } from '../../common/identity';
import { DocumentWriteDto, DocumentsQuery } from './dto/documents.dto';
import { DocumentsService } from './documents.service';

@ApiTags('Documents')
@ApiBearerAuth()
@Controller()
export class DocumentsController {
  constructor(private readonly documents: DocumentsService) {}

  @OptionalAuth()
  @Get('documents')
  list(@Query() query: DocumentsQuery) {
    return this.documents.listPublic(query);
  }

  @OptionalAuth()
  @Get('documents/:documentId')
  detail(@Param('documentId') documentId: string, @CurrentUser() actor?: IdentityContext) {
    return this.documents.detail(documentId, actor);
  }

  @Post('documents')
  create(@CurrentUser() actor: IdentityContext, @Body() dto: DocumentWriteDto) {
    return this.documents.create(actor.userId, dto);
  }

  @Get('users/me/documents')
  mine(@CurrentUser() actor: IdentityContext, @Query() query: DocumentsQuery) {
    return this.documents.mine(actor.userId, query);
  }

  @OptionalAuth()
  @Get('documents/:documentId/preview-access')
  preview(@Param('documentId') documentId: string, @CurrentUser() actor?: IdentityContext) {
    return this.documents.previewAccess(documentId, actor);
  }

  @OptionalAuth()
  @Post('documents/:documentId/download-access')
  download(@Param('documentId') documentId: string, @CurrentUser() actor?: IdentityContext) {
    return this.documents.downloadAccess(documentId, actor);
  }
}
