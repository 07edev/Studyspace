import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Put, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, SuperAdminOnly } from '../../common/decorators/auth.decorators';
import type { IdentityContext } from '../../common/identity';
import type { RequestWithId } from '../../common/middleware/request-id.middleware';
import { PageQuery } from '../../common/utils/page';
import { AdminAdminsService } from './admin-admins.service';
import { AdminCreateDto, AdminPatchDto } from './dto/admin-admins.dto';

@ApiTags('AdminAdmins')
@ApiBearerAuth()
@SuperAdminOnly()
@Controller('admin/admins')
export class AdminAdminsController {
  constructor(private readonly service: AdminAdminsService) {}

  @Get()
  list(@Query() query: PageQuery) {
    return this.service.list(query);
  }

  @Post()
  create(@CurrentUser() actor: IdentityContext, @Body() dto: AdminCreateDto, @Req() req: RequestWithId) {
    return this.service.create(actor, dto, req.requestId);
  }

  @Get(':adminId')
  get(@Param('adminId') adminId: string) {
    return this.service.get(adminId);
  }

  @HttpCode(200)
  @Patch(':adminId')
  patch(
    @CurrentUser() actor: IdentityContext,
    @Param('adminId') adminId: string,
    @Body() dto: AdminPatchDto,
    @Req() req: RequestWithId,
  ) {
    return this.service.patch(actor, adminId, dto, req.requestId);
  }

  @HttpCode(200)
  @Put(':adminId/permissions')
  permissions(
    @CurrentUser() actor: IdentityContext,
    @Param('adminId') adminId: string,
    @Body() dto: AdminPatchDto,
    @Req() req: RequestWithId,
  ) {
    return this.service.replacePermissions(actor, adminId, dto, req.requestId);
  }

  @HttpCode(204)
  @Delete(':adminId')
  async remove(@CurrentUser() actor: IdentityContext, @Param('adminId') adminId: string, @Req() req: RequestWithId) {
    await this.service.remove(actor, adminId, req.requestId);
  }
}
