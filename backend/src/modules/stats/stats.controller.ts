import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RequirePermission } from '../../common/decorators/auth.decorators';
import { ActivityQuery, DashboardQuery, OverviewQuery } from './stats.dto';
import { StatsService } from './stats.service';

@ApiTags('AdminStats')
@ApiBearerAuth()
@RequirePermission('STATISTICS', 'READ')
@Controller('admin')
export class StatsController {
  constructor(private readonly service: StatsService) {}

  @Get('dashboard')
  dashboard(@Query() query: DashboardQuery) {
    return this.service.dashboard(query);
  }

  @Get('statistics/overview')
  overview(@Query() query: OverviewQuery) {
    return this.service.overview(query);
  }

  @Get('statistics/activity')
  activity(@Query() query: ActivityQuery) {
    return this.service.activity(query);
  }
}
