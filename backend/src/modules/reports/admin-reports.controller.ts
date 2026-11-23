import { Body, Controller, Get, Param, Patch, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, RequirePermission } from '../../common/decorators/auth.decorators';
import type { IdentityContext } from '../../common/identity';
import type { RequestWithId } from '../../common/middleware/request-id.middleware';
import {
  ReportAssignmentDto,
  ReportDecisionDto,
  ReportsQuery,
} from './dto/reports.dto';
import { ReportsService } from './reports.service';

@ApiTags('Admin Reports')
@ApiBearerAuth()
@Controller('admin/reports')
export class AdminReportsController {
  constructor(private readonly reports: ReportsService) {}

  @RequirePermission('REPORTS', 'READ')
  @Get()
  list(@Query() query: ReportsQuery) {
    return this.reports.adminList(query);
  }

  @RequirePermission('REPORTS', 'READ')
  @Get(':reportId')
  detail(@Param('reportId') reportId: string) {
    return this.reports.adminDetail(reportId);
  }

  @RequirePermission('REPORTS', 'ASSIGN')
  @Patch(':reportId/assignment')
  assign(
    @Param('reportId') reportId: string,
    @CurrentUser() actor: IdentityContext,
    @Body() dto: ReportAssignmentDto,
    @Req() req: RequestWithId,
  ) {
    return this.reports.assign(actor, reportId, dto, req.requestId);
  }

  @RequirePermission('REPORTS', 'MODERATE')
  @Patch(':reportId/decision')
  decide(
    @Param('reportId') reportId: string,
    @CurrentUser() actor: IdentityContext,
    @Body() dto: ReportDecisionDto,
    @Req() req: RequestWithId,
  ) {
    return this.reports.decide(actor, reportId, dto, req.requestId);
  }
}
