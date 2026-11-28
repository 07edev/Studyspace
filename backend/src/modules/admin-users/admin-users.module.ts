import { Global, Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AdminUsersController } from './admin-users.controller';
import { AdminUsersService } from './admin-users.service';
import { UserContentRef, UserContentRegistry } from './ports';

@Global()
@Module({
  imports: [AuthModule],
  controllers: [AdminUsersController],
  providers: [
    AdminUsersService,
    UserContentRegistry,
    { provide: UserContentRef, useExisting: UserContentRegistry },
  ],
  exports: [AdminUsersService, UserContentRegistry],
})
export class AdminUsersModule {}
