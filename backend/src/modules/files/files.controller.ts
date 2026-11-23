import { Body, Controller, Delete, Get, HttpCode, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, OptionalAuth } from '../../common/decorators/auth.decorators';
import type { IdentityContext } from '../../common/identity';
import { FileUploadInitDto } from './dto/files.dto';
import { FilesService } from './files.service';

@ApiTags('Files')
@ApiBearerAuth()
@Controller()
export class FilesController {
  constructor(private readonly files: FilesService) {}

  @Post('files/uploads')
  initiate(@CurrentUser() actor: IdentityContext, @Body() dto: FileUploadInitDto) {
    return this.files.initiate(actor.userId, dto);
  }

  @Post('files/uploads/:fileId/complete')
  complete(@CurrentUser() actor: IdentityContext, @Param('fileId') fileId: string) {
    return this.files.complete(actor.userId, fileId);
  }

  @Get('files/uploads/:fileId')
  status(@CurrentUser() actor: IdentityContext, @Param('fileId') fileId: string) {
    return this.files.status(actor.userId, fileId);
  }

  @HttpCode(204)
  @Delete('files/uploads/:fileId')
  async remove(@CurrentUser() actor: IdentityContext, @Param('fileId') fileId: string) {
    await this.files.remove(actor.userId, fileId);
  }

  @OptionalAuth()
  @Get('files/:fileId/access')
  access(@Param('fileId') fileId: string, @CurrentUser() actor?: IdentityContext) {
    return this.files.createAccess(fileId, actor);
  }
}
