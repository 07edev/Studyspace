import { Controller, Get } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { ApiTags } from '@nestjs/swagger';
import { Connection } from 'mongoose';
import { Public } from '../../common/decorators/auth.decorators';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(@InjectConnection() private readonly connection: Connection) {}

  @Public()
  @Get()
  check() {
    // readyState 1 = connected.
    const up = this.connection.readyState === 1;
    return { status: up ? 'ok' : 'degraded', database: up ? 'up' : 'down' };
  }
}
