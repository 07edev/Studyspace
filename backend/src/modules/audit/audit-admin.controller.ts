import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RequirePermission } from '../../common/decorators/auth.decorators';
import { AuditAdminService } from './audit-admin.service';
import { AuditLogQuery } from './audit-admin.dto';

@ApiTags('AdminAudit')
@ApiBearerAuth()
@RequirePermission('AUDIT', 'READ')
@Controller('admin/audit-logs')
export class AuditAdminController {
  constructor(private readonly service: AuditAdminService) {}

  @Get()
  list(@Query() query: AuditLogQuery) {
    return this.service.list(query);
  }

  @Get(':auditId')
  get(@Param('auditId') auditId: string) {
    return this.service.get(auditId);
  }
}
