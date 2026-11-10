import { Module } from '@nestjs/common';
import {
  FileReadyRef,
  NotConnectedFileReadyRef,
  NotConnectedTaxonomyRef,
  TaxonomyRef,
} from './ports';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  controllers: [UsersController],
  providers: [
    UsersService,
    // TV2/TV3: when your module is ready, change `useClass` to your real implementation
    // (see ports.ts for the exact contract). Until then requests that need them get 503.
    { provide: TaxonomyRef, useClass: NotConnectedTaxonomyRef },
    { provide: FileReadyRef, useClass: NotConnectedFileReadyRef },
  ],
  exports: [UsersService],
})
export class UsersModule {}
