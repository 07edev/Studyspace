import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ReportsModule } from '../reports/reports.module';
import { AdminUsersController } from './admin-users.controller';
import { AdminUsersService } from './admin-users.service';
import { UserContentRef } from './ports';
import { Tv3UserContentRef } from '../reports/user-content-ref';

@Module({
  imports: [AuthModule, ReportsModule],
  controllers: [AdminUsersController],
  providers: [
    AdminUsersService,
    { provide: UserContentRef, useExisting: Tv3UserContentRef },
  ],
  exports: [AdminUsersService],
})
export class AdminUsersModule {}
