import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AdminUsersController } from './admin-users.controller';
import { AdminUsersService } from './admin-users.service';
import { NotConnectedUserContentRef, UserContentRef } from './ports';

@Module({
  imports: [AuthModule],
  controllers: [AdminUsersController],
  providers: [
    AdminUsersService,
    // TV2/TV3: replace `useClass` with your class that extends NotConnectedUserContentRef and
    // overrides the kinds you own (see ports.ts). Until then counts are omitted and tabs answer 503.
    { provide: UserContentRef, useClass: NotConnectedUserContentRef },
  ],
  exports: [AdminUsersService],
})
export class AdminUsersModule {}
