import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AdminAdminsController } from './admin-admins.controller';
import { AdminAdminsService } from './admin-admins.service';

@Module({
  imports: [AuthModule],
  controllers: [AdminAdminsController],
  providers: [AdminAdminsService],
})
export class AdminAdminsModule {}
