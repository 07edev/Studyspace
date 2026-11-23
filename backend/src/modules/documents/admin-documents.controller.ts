import { Body, Controller, Get, Param, Patch, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, RequirePermission } from '../../common/decorators/auth.decorators';
import type { IdentityContext } from '../../common/identity';
import type { RequestWithId } from '../../common/middleware/request-id.middleware';
import { DocumentModerationDto, DocumentsQuery } from './dto/documents.dto';
import { DocumentsService } from './documents.service';

@ApiTags('Admin Documents')
@ApiBearerAuth()
@Controller('admin/documents')
export class AdminDocumentsController {
  constructor(private readonly documents: DocumentsService) {}

  @RequirePermission('DOCUMENTS', 'READ')
  @Get()
  list(@Query() query: DocumentsQuery) {
    return this.documents.listAdmin(query);
  }

  @RequirePermission('DOCUMENTS', 'READ')
  @Get(':documentId')
  detail(@Param('documentId') documentId: string) {
    return this.documents.adminDetail(documentId);
  }

  @RequirePermission('DOCUMENTS', 'READ')
  @Get(':documentId/preview-access')
  preview(@Param('documentId') documentId: string, @CurrentUser() actor: IdentityContext) {
    return this.documents.adminPreviewAccess(documentId, actor);
  }

  @RequirePermission('DOCUMENTS', 'MODERATE')
  @Patch(':documentId/moderation')
  moderate(
    @Param('documentId') documentId: string,
    @CurrentUser() actor: IdentityContext,
    @Body() dto: DocumentModerationDto,
    @Req() req: RequestWithId,
  ) {
    return this.documents.moderate(actor, documentId, dto, req.requestId);
  }
}
