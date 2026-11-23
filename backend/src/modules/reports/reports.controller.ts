import { Body, Controller, Get, Param, Post, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/auth.decorators';
import type { IdentityContext } from '../../common/identity';
import type { RequestWithId } from '../../common/middleware/request-id.middleware';
import { CreateReportDto, ReportsQuery } from './dto/reports.dto';
import { ReportsService } from './reports.service';

@ApiTags('Reports')
@ApiBearerAuth()
@Controller('reports')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Post()
  create(
    @CurrentUser() actor: IdentityContext,
    @Body() dto: CreateReportDto,
    @Req() req: RequestWithId,
  ) {
    return this.reports.create(actor.userId, dto, req.requestId);
  }

  @Get('mine')
  mine(@CurrentUser() actor: IdentityContext, @Query() query: ReportsQuery) {
    return this.reports.mine(actor.userId, query);
  }

  @Get(':reportId')
  detail(@CurrentUser() actor: IdentityContext, @Param('reportId') reportId: string) {
    return this.reports.detail(actor.userId, reportId);
  }
}
