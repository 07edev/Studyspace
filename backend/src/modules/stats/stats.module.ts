import { Global, Module } from '@nestjs/common';
import { StatsController } from './stats.controller';
import { StatsRegistry } from './stats.registry';
import { StatsService } from './stats.service';

// Global so TV2/TV3 modules can inject StatsRegistry and register their contributor.
@Global()
@Module({
  controllers: [StatsController],
  providers: [StatsService, StatsRegistry],
  exports: [StatsRegistry],
})
export class StatsModule {}
